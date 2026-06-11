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
  caption: string,
  videoId: string,
): Promise<GeneratedVideo | null> {
  if (images.length === 0) {
    console.warn('No images provided for video generation')
    return null
  }

  try {
    const outputDir = path.join(process.cwd(), 'public/videos')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const videoPath = path.join(outputDir, `${videoId}.mp4`)
    const thumbnailPath = path.join(outputDir, `${videoId}-thumb.jpg`)

    // Build ffmpeg command to concatenate images
    // Each image displayed for 3 seconds, then add text overlay with caption
    const duration = images.length * 3

    // Create a concat demuxer file
    const concatFile = path.join(outputDir, `${videoId}-concat.txt`)
    const concatContent = images.map((img) => `file '${path.join(process.cwd(), img)}'`).join('\n')
    fs.writeFileSync(concatFile, concatContent)

    // FFmpeg command: concat images, scale, add text overlay, export as MP4
    const ffmpegCmd = `ffmpeg -f concat -safe 0 -i "${concatFile}" -vf "scale=1200:675:force_original_aspect_ratio=decrease,pad=1200:675:(ow-iw)/2:(oh-ih)/2,drawtext=text='${caption.replace(/'/g, "\\'")}':fontfile=/System/Library/Fonts/Helvetica.ttc:fontsize=24:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2" -c:v libx264 -preset medium -crf 23 -r 30 -t ${duration} "${videoPath}" -y 2>&1`

    try {
      execSync(ffmpegCmd, { stdio: 'pipe' })
    } catch (error) {
      // Graceful degradation if ffmpeg not available or fails
      console.warn('FFmpeg video generation failed, will use image fallback:', error)
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath)
      }
      return null
    }

    // Generate thumbnail from first image
    try {
      const thumbnailCmd = `ffmpeg -i "${path.join(process.cwd(), images[0])}" -vf "scale=1200:675:force_original_aspect_ratio=decrease,pad=1200:675:(ow-iw)/2:(oh-ih)/2" -y "${thumbnailPath}" 2>&1`
      execSync(thumbnailCmd, { stdio: 'pipe' })
    } catch (error) {
      console.warn('Thumbnail generation failed:', error)
    }

    // Cleanup concat file
    if (fs.existsSync(concatFile)) {
      fs.unlinkSync(concatFile)
    }

    return {
      videoPath: `/videos/${videoId}.mp4`,
      thumbnailPath: `/videos/${videoId}-thumb.jpg`,
      duration,
    }
  } catch (error) {
    console.error('Video generation failed:', error)
    return null
  }
}
