/**
 * lib/sma/video-generator.ts
 *
 * Generate promotional videos from product images using ffmpeg.
 * Videos include text overlays and are optimized for social media platforms.
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

/**
 * Generate a video from images with text overlay.
 * Returns the relative path to the generated video and thumbnail.
 */
export async function generateProductVideo(
  images: string[],
  captionText: string,
  videoId: string,
): Promise<{ videoPath: string; thumbnailPath: string; duration: number }> {
  if (images.length === 0) {
    throw new Error('At least one image is required to generate a video')
  }

  // Create output directory
  const outputDir = path.join(process.cwd(), 'public/videos/generated')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Prepare full image paths
  const imagePaths = images.map((img) => path.join(process.cwd(), 'public', img))

  // Verify all images exist
  for (const imgPath of imagePaths) {
    if (!fs.existsSync(imgPath)) {
      throw new Error(`Image not found: ${imgPath}`)
    }
  }

  // Generate unique filenames
  const timestamp = Date.now()
  const videoFileName = `video_${videoId}_${timestamp}.mp4`
  const thumbnailFileName = `thumb_${videoId}_${timestamp}.jpg`
  const videoPath = path.join(outputDir, videoFileName)
  const thumbnailPath = path.join(outputDir, thumbnailFileName)

  try {
    // Create concat file for ffmpeg
    const concatFile = path.join(outputDir, `concat_${timestamp}.txt`)
    const concatContent = imagePaths.map((img) => `file '${img}'\nduration 3\n`).join('')
    fs.writeFileSync(concatFile, concatContent)

    // Prepare text for overlay (limit to 80 chars for readability)
    const textForOverlay = captionText.substring(0, 80).replace(/'/g, "\\'")

    // Build ffmpeg command using execSync with proper argument handling
    // Chain filters with single -vf: concat -> drawtext -> scale
    const cmd = [
      'ffmpeg',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFile,
      '-vf', `[0:v]fps=30,scale=1200:675:force_original_aspect_ratio=decrease,pad=1200:675:(ow-iw)\\2:(oh-ih)\\2,drawtext=text='${textForOverlay}':fontsize=32:fontcolor=white:x=10:y=10:shadowcolor=black:shadowx=2:shadowy=2:line_spacing=10:box=1:boxcolor=black@0.5[v]`,
      '-map', '[v]',
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-y',
      videoPath,
    ]

    // Execute ffmpeg
    execSync(cmd.join(' '), { stdio: 'pipe', timeout: 120000, shell: '/bin/bash' })

    // Generate thumbnail from first image
    const thumbCmd = [
      'ffmpeg',
      '-i', imagePaths[0],
      '-vf', 'scale=1200:675:force_original_aspect_ratio=decrease,pad=1200:675:(ow-iw)\\2:(oh-ih)\\2',
      '-y',
      thumbnailPath,
    ]

    execSync(thumbCmd.join(' '), { stdio: 'pipe', timeout: 30000, shell: '/bin/bash' })

    // Clean up concat file
    fs.unlinkSync(concatFile)

    // Calculate duration: 3 seconds per image + 1 second transition
    const duration = images.length * 3 + 1

    // Return relative paths
    return {
      videoPath: `/videos/generated/${videoFileName}`,
      thumbnailPath: `/videos/generated/${thumbnailFileName}`,
      duration,
    }
  } catch (error) {
    // Cleanup on error
    try {
      if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath)
      if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath)
    } catch {
      // Ignore cleanup errors
    }

    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    // Check if ffmpeg is installed
    if (errorMsg.includes('ENOENT') || errorMsg.includes('not found')) {
      throw new Error(
        'ffmpeg is not installed. Video generation requires ffmpeg to be installed on the system. Captions and images will still be generated.',
      )
    }

    throw new Error(`Video generation failed: ${errorMsg}`)
  }
}
