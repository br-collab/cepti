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
  targetDurationSeconds: number = 45,
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

    // Calculate duration: target 45 seconds with multiple images
    // Each image gets proportional time (e.g., 6 images × 7.5 sec = 45 sec)
    const secondsPerImage = Math.max(3, Math.floor(targetDurationSeconds / images.length))
    const duration = secondsPerImage * images.length

    // Create a concat demuxer file
    const concatFile = path.join(outputDir, `${videoId}-concat.txt`)
    // Paths are /images/... format, convert to filesystem-compatible public/images/...
    const concatContent = images.map((img) => {
      const fsPath = img.startsWith('/') ? `public${img}` : img
      return `file '${path.join(process.cwd(), fsPath)}'`
    }).join('\n')
    fs.writeFileSync(concatFile, concatContent)

    // Extract short text overlay from caption (just first sentence/hook, stripped of special chars)
    // Video text overlay should be simple and readable, full caption goes in social post
    const textOverlay = caption
      .split('\n')[0] // Take first line
      .replace(/\*\*/g, '') // Remove markdown bold
      .replace(/[^\w\s\?\!\-\.]/g, '') // Remove emojis and special chars
      .substring(0, 80) // Max 80 chars for readability
      .trim()

    // FFmpeg command: concat images and export as MP4
    // Use simpler filter without complex scaling to avoid format compatibility issues
    const ffmpegCmd = `ffmpeg -f concat -safe 0 -i "${concatFile}" -c:v libx264 -preset medium -crf 23 -r 30 -t ${duration} "${videoPath}" -y 2>&1`

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
      const firstImg = images[0]
      const fsPath = firstImg.startsWith('/') ? `public${firstImg}` : firstImg
      const thumbnailCmd = `ffmpeg -i "${path.join(process.cwd(), fsPath)}" -vf "scale=1200:675:force_original_aspect_ratio=decrease,pad=1200:675:(ow-iw)/2:(oh-ih)/2" -y "${thumbnailPath}" 2>&1`
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
