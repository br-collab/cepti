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

    // Prepare text for overlay (escape quotes for ffmpeg)
    const escapedText = captionText.replace(/'/g, "'\\''").substring(0, 100) // Limit to 100 chars

    // Build ffmpeg command
    // Display each image for 3 seconds, add text overlay, output as MP4
    const ffmpegCmd = [
      'ffmpeg',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFile,
      '-vf', `drawtext=text='${escapedText}':fontsize=32:fontcolor=white:x=10:y=10:shadowcolor=black:shadowx=2:shadowy=2:line_spacing=10:box=1:boxcolor=black@0.5`,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-r', '30',
      '-vf', `fps=30,scale=1200:675:force_original_aspect_ratio=decrease,pad=1200:675:(ow-iw)/2:(oh-ih)/2`,
      '-y', // Overwrite output file
      videoPath,
    ].join(' ')

    // Execute ffmpeg
    execSync(ffmpegCmd, { stdio: 'pipe', timeout: 60000 })

    // Generate thumbnail from first image
    const ffmpegThumbCmd = [
      'ffmpeg',
      '-i', imagePaths[0],
      '-vf', 'scale=1200:675:force_original_aspect_ratio=decrease,pad=1200:675:(ow-iw)/2:(oh-ih)/2',
      '-y', // Overwrite
      thumbnailPath,
    ].join(' ')

    execSync(ffmpegThumbCmd, { stdio: 'pipe', timeout: 30000 })

    // Clean up concat file
    fs.unlinkSync(concatFile)

    // Calculate duration: 3 seconds per image + transition time
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

    throw new Error(`Video generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
