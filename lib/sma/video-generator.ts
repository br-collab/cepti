import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

export interface GeneratedVideo {
  videoPath: string
  thumbnailPath: string
  duration: number
}

export async function generateProductVideo(
  images: string[],
  _caption: string,
  videoId: string,
  targetDurationSeconds: number = 45,
): Promise<GeneratedVideo | null> {
  if (images.length === 0) {
    console.warn('[VideoGenerator] No images provided')
    return null
  }

  const outputDir = path.join(process.cwd(), 'public/videos')
  const concatFile = path.join(outputDir, `${videoId}-concat.txt`)

  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const videoPath = path.join(outputDir, `${videoId}.mp4`)
    const thumbnailPath = path.join(outputDir, `${videoId}-thumb.jpg`)

    // Each image shown for proportional duration, minimum 3 seconds
    const secondsPerImage = Math.max(3, Math.floor(targetDurationSeconds / images.length))
    const duration = secondsPerImage * images.length

    // Build concat demuxer file with explicit duration per image.
    // Without duration directives, FFmpeg reads only 1 frame per still image.
    // The last image is listed twice (second time without duration) to anchor
    // the final frame — otherwise FFmpeg drops it due to timestamp handling.
    const lines: string[] = []
    for (const img of images) {
      const fsPath = img.startsWith('/') ? `public${img}` : img
      const fullPath = path.join(process.cwd(), fsPath)
      lines.push(`file '${fullPath}'`)
      lines.push(`duration ${secondsPerImage}`)
    }
    // Duplicate last entry (no duration) to prevent final frame truncation
    const lastImg = images[images.length - 1]
    const lastFsPath = lastImg.startsWith('/') ? `public${lastImg}` : lastImg
    lines.push(`file '${path.join(process.cwd(), lastFsPath)}'`)

    fs.writeFileSync(concatFile, lines.join('\n'))

    console.log('[VideoGenerator] Concat file:', concatFile)
    console.log('[VideoGenerator] Content:\n', lines.join('\n'))

    // scale forces even pixel dimensions (libx264 requirement)
    // pix_fmt yuv420p ensures broad playback compatibility
    const ffmpegCmd = `ffmpeg -f concat -safe 0 -i "${concatFile}" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -preset medium -crf 23 -r 30 -pix_fmt yuv420p -t ${duration} "${videoPath}" -y`

    console.log('[VideoGenerator] Running:', ffmpegCmd)

    try {
      const output = execSync(ffmpegCmd, { stdio: 'pipe' })
      console.log('[VideoGenerator] FFmpeg output:', output?.toString?.() || '(none)')
    } catch (err) {
      const stderr = (err as { stderr?: Buffer }).stderr
      console.error('[VideoGenerator] FFmpeg failed. stderr:', stderr ? stderr.toString().slice(-1000) : String(err))
      if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath)
      if (fs.existsSync(concatFile)) fs.unlinkSync(concatFile)
      return null
    }

    // Generate thumbnail from first image
    try {
      const firstImg = images[0]
      const fsPath = firstImg.startsWith('/') ? `public${firstImg}` : firstImg
      const thumbnailCmd = `ffmpeg -i "${path.join(process.cwd(), fsPath)}" -vf "scale=1200:675:force_original_aspect_ratio=decrease,pad=1200:675:(ow-iw)/2:(oh-ih)/2" -frames:v 1 -y "${thumbnailPath}"`
      execSync(thumbnailCmd, { stdio: 'pipe' })
    } catch (err) {
      const stderr = (err as { stderr?: Buffer }).stderr
      console.warn('[VideoGenerator] Thumbnail failed:', stderr ? stderr.toString().slice(-300) : String(err))
    }

    if (fs.existsSync(concatFile)) fs.unlinkSync(concatFile)

    const stat = fs.statSync(videoPath)
    console.log(`[VideoGenerator] Success: ${videoPath} (${stat.size} bytes, ${duration}s)`)

    return {
      videoPath: `/videos/${videoId}.mp4`,
      thumbnailPath: `/videos/${videoId}-thumb.jpg`,
      duration,
    }
  } catch (err) {
    if (fs.existsSync(concatFile)) fs.unlinkSync(concatFile)
    console.error('[VideoGenerator] Unexpected error:', err)
    return null
  }
}
