import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

export interface GeneratedVideo {
  videoPath: string
  thumbnailPath: string
  duration: number
}

// Strip markdown/URLs/emoji and common LLM preamble ("Here's your caption for X:")
// before passing to TTS — preamble triggers macOS voice-switching away from Spanish.
function cleanTextForTTS(raw: string): string {
  return raw
    .replace(/^[^\n]*(here['']?s|here is|below is|the following)[^\n]*\n+/im, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/_/g, ' ')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/#\w+/g, '')
    .replace(/\[ref:[^\]]+\]/g, '')
    .replace(/[^\w\s?!.,;:\-áéíóúüñÁÉÍÓÚÜÑ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 600) // ~45 s at natural speaking pace
}

// OpenAI TTS — natural-sounding Spanish narration.
// Returns true and writes MP3 to outputPath on success.
async function generateOpenAITTS(text: string, outputPath: string): Promise<boolean> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return false

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        voice: 'fable',
        input: text,
        response_format: 'mp3',
        speed: 1.0,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error(`[VideoGenerator] OpenAI TTS ${response.status}:`, err.slice(0, 300))
      return false
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    fs.writeFileSync(outputPath, buffer)
    console.log(`[VideoGenerator] OpenAI TTS: ${Math.round(buffer.length / 1024)}KB`)
    return true
  } catch (err) {
    console.error('[VideoGenerator] OpenAI TTS fetch error:', err)
    return false
  }
}

// Fallback: macOS say with Paulina (Mexican Spanish compact voice).
function generateMacOSTTS(text: string, scriptFile: string, aiffPath: string, mp3Path: string): boolean {
  try {
    fs.writeFileSync(scriptFile, text)
    execSync(`say -v Paulina -r 145 -f "${scriptFile}" -o "${aiffPath}"`, { stdio: 'pipe' })
    execSync(`ffmpeg -i "${aiffPath}" -c:a libmp3lame -b:a 128k "${mp3Path}" -y`, { stdio: 'pipe' })
    return true
  } catch (err) {
    console.warn('[VideoGenerator] macOS TTS fallback failed:', String(err).slice(0, 200))
    return false
  }
}

export async function generateProductVideo(
  images: string[],
  caption: string,
  videoId: string,
  targetDurationSeconds: number = 45,
): Promise<GeneratedVideo | null> {
  if (images.length === 0) {
    console.warn('[VideoGenerator] No images provided')
    return null
  }

  const outputDir = path.join(process.cwd(), 'public/videos')
  const concatFile = path.join(outputDir, `${videoId}-concat.txt`)
  const audioMp3 = path.join(outputDir, `${videoId}.mp3`)
  const audioAiff = path.join(outputDir, `${videoId}.aiff`)
  const scriptFile = path.join(outputDir, `${videoId}-script.txt`)
  const tempFiles = [concatFile, audioMp3, audioAiff, scriptFile]

  const cleanup = () => {
    for (const f of tempFiles) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f) } catch { /* ignore */ }
    }
  }

  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const videoPath = path.join(outputDir, `${videoId}.mp4`)
    const thumbnailPath = path.join(outputDir, `${videoId}-thumb.jpg`)

    // ── 1. TTS narration ─────────────────────────────────────────────────
    let audioAvailable = false
    let audioDuration = targetDurationSeconds

    const cleanedText = cleanTextForTTS(caption)
    if (cleanedText.length > 20) {
      // Try OpenAI TTS first (natural), fall back to macOS say
      const openAIok = await generateOpenAITTS(cleanedText, audioMp3)
      if (!openAIok) {
        generateMacOSTTS(cleanedText, scriptFile, audioAiff, audioMp3)
      }

      if (fs.existsSync(audioMp3) && fs.statSync(audioMp3).size > 0) {
        try {
          const probeOut = execSync(
            `ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioMp3}"`,
            { stdio: 'pipe' },
          ).toString().trim()
          const parsed = parseFloat(probeOut)
          if (!isNaN(parsed) && parsed > 1) {
            audioDuration = Math.ceil(parsed)
            audioAvailable = true
            console.log(`[VideoGenerator] Audio: ${audioDuration}s (openai=${openAIok})`)
          }
        } catch { /* ffprobe failed — continue without audio */ }
      }
    }

    // ── 2. Concat demuxer file with explicit per-image duration ───────────
    // Without duration directives, FFmpeg reads only 1 frame per still image.
    // Last image duplicated (no duration) to anchor the final frame.
    const secondsPerImage = Math.max(3, Math.ceil(audioDuration / images.length))
    const videoDuration = secondsPerImage * images.length

    const lines: string[] = []
    for (const img of images) {
      const fsPath = img.startsWith('/') ? `public${img}` : img
      lines.push(`file '${path.join(process.cwd(), fsPath)}'`)
      lines.push(`duration ${secondsPerImage}`)
    }
    const lastImg = images[images.length - 1]
    const lastFsPath = lastImg.startsWith('/') ? `public${lastImg}` : lastImg
    lines.push(`file '${path.join(process.cwd(), lastFsPath)}'`)
    fs.writeFileSync(concatFile, lines.join('\n'))

    // ── 3. FFmpeg encode ─────────────────────────────────────────────────
    // scale forces even pixel dims (libx264 requirement)
    // -movflags +faststart moves moov atom to front (browser needs this to show duration)
    // -shortest ends encoding when the shorter stream (audio) finishes
    const audioArgs = audioAvailable ? [`-i "${audioMp3}"`, '-c:a aac', '-shortest'] : []

    const ffmpegArgs = [
      'ffmpeg',
      `-f concat -safe 0 -i "${concatFile}"`,
      ...audioArgs,
      '-vf "scale=trunc(iw/2)*2:trunc(ih/2)*2"',
      '-c:v libx264 -preset medium -crf 23 -r 30 -pix_fmt yuv420p',
      '-movflags +faststart',
      audioAvailable ? '' : `-t ${videoDuration}`,
      `"${videoPath}" -y`,
    ].filter(Boolean)

    const ffmpegCmd = ffmpegArgs.join(' ')
    console.log('[VideoGenerator] Running:', ffmpegCmd)

    try {
      execSync(ffmpegCmd, { stdio: 'pipe' })
    } catch (err) {
      const stderr = (err as { stderr?: Buffer }).stderr
      console.error('[VideoGenerator] FFmpeg failed:\n', stderr ? stderr.toString().slice(-1000) : String(err))
      if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath)
      cleanup()
      return null
    }

    // ── 4. Thumbnail from first image ────────────────────────────────────
    try {
      const firstImg = images[0]
      const fsPath = firstImg.startsWith('/') ? `public${firstImg}` : firstImg
      execSync(
        `ffmpeg -i "${path.join(process.cwd(), fsPath)}" -vf "scale=1200:675:force_original_aspect_ratio=decrease,pad=1200:675:(ow-iw)/2:(oh-ih)/2" -frames:v 1 -y "${thumbnailPath}"`,
        { stdio: 'pipe' },
      )
    } catch (err) {
      const stderr = (err as { stderr?: Buffer }).stderr
      console.warn('[VideoGenerator] Thumbnail failed:', stderr ? stderr.toString().slice(-200) : String(err))
    }

    cleanup()

    const stat = fs.statSync(videoPath)
    console.log(`[VideoGenerator] Done: ${videoPath} (${Math.round(stat.size / 1024)}KB, audio=${audioAvailable})`)

    return {
      videoPath: `/videos/${videoId}.mp4`,
      thumbnailPath: `/videos/${videoId}-thumb.jpg`,
      duration: audioAvailable ? audioDuration : videoDuration,
    }
  } catch (err) {
    cleanup()
    console.error('[VideoGenerator] Unexpected error:', err)
    return null
  }
}
