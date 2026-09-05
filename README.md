# BatchCut

**English | [简体中文](README_zh-CN.md)**

An FFmpeg-based desktop tool for batch video cutting.

Focused on a single streamlined workflow: **Folder → Scan → Mark → Batch Cut**, providing core capabilities such as lossless stream-copy at original quality, frame-accurate cutting, large clip-name watermarks, and cover/poster embedding.

## Features

| Feature | Description |
|------|------|
| Folder scanning | One-click scan of all common video formats in a directory (mp4 / mov / mkv / avi / webm / flv / ts / m4v / wmv / mpeg / mpg / 3gp / ogv / rmvb), automatically reading duration / resolution / frame rate / size |
| Playback & marking | Built-in player for marking segment start/end times (keyboard shortcuts `[` / `]` supported), with manual fine-tuning of times and names |
| Single-video cutting | Output multiple marked segments of a single video one by one |
| Batch cutting | Check multiple videos in the table and export them all at once |
| 5 quality levels | Original (stream copy), 480p (scaled re-encode), HD (CRF 18), Standard (CRF 23), Smooth (CRF 28) |
| Clip-name watermark | Overlays the clip name on the video with a customizable style for the first 2 seconds, and embeds it as a cover poster in the video |
| Real-time progress | Reports overall and per-clip progress via the `video:progress` channel, with cancellation awareness |
| Automatic fallback | If original-quality stream copy fails, automatically falls back to re-encoding retry for compatibility |
| Minimal dependencies | Only 2 runtime dependencies (vue + naive-ui), no AI / database / GPU acceleration libraries — small `npm install` footprint |
| Stream-copy first | Original-quality mode copies the video stream directly with **no re-encoding** — near-zero CPU usage, export speed ≈ disk read/write speed |
| Low memory & CPU | Single-page architecture with partial refreshes; no rich-text editors or pre-rendered previews; runtime memory typically < 200 MB (excluding player decoding) |
| No GPU requirement | Works on pure CPU, **no CUDA / NVENC / VideoToolbox dependency** — runs smoothly on old laptops and desktops with integrated graphics |
| Cross-platform packaging | One-command packaging for Windows / macOS / Linux via electron-builder; installer is only tens of MB |

## Use Cases

Centered on the core workflow of **batch marking → batch output**, this tool fits the following common scenarios:

### 🏅 Sports Highlights

| Scenario | Pain point | Tool capability |
|------|------|---------|
| **Football / Basketball / Badminton matches** | A 90-minute match may contain only 5 minutes worth keeping, with key moments scattered across the timeline | Mark goals / assists / red cards segment by segment, output "Match_Highlight_1.mp4", "Match_Highlight_2.mp4"; batch watermarks make social-media publishing easy |
| **Marathon / trail running footage** | 5 hours of footage where only the start, finish line, and cheering moments matter | Stream copy preserves original quality, avoiding detail loss from re-encoding |
| **Esports recordings** | Hours of match footage where you only care about team fights and key kills | Second-accurate marking + original-quality output, easy to post to video platforms |

### 📹 Surveillance / Security Clip Extraction

| Scenario | Pain point | Tool capability |
|------|------|---------|
| **Residential / storefront CCTV** | 24/7 continuous recording (often hundreds of GB); afterwards you only need a specific time window | Batch mark "theft period", "suspicious person period" and export standalone mp4s for evidence archiving |
| **Dashcams** | Long loop recordings where you only need the clips before/after an accident | Mark and batch-export, with "Accident 1", "Accident 2" watermarks — handy when dealing with insurance companies |
| **Pet monitoring** | All-day recording where you only want the pet mischief and funny bits | Mark and export short clips to share in pet communities |
| **Drone footage** | Tens of minutes of footage where only takeoff, descent, and tracking shots are worth keeping | Stream copy preserves original 4K quality; watermarks help identify shooting locations |

### 🎓 Teaching / Course Recording

| Scenario | Pain point | Tool capability |
|------|------|---------|
| **Online course recordings** | A 2-hour screen recording has only 30 minutes of key content; the rest is waiting/page-flipping/lagging | Batch-remove dead segments and keep the highlights for publishing |
| **Meeting recordings** | A 2-hour meeting contains only 10 minutes of decisions | Mark key statements and output "Decision 1", "Decision 2" |
| **Training lectures** | Repeated content in recordings | Mark with "Key Point 1", "Key Point 2" watermarks and publish to internal training platforms |
| **Exam playback** | Hours of proctoring footage where only violations matter | Mark + batch export, easy to retain as evidence |

### 🎬 Live-stream Clips / Remixes

| Scenario | Pain point | Tool capability |
|------|------|---------|
| **Live-stream highlights** | A 4-hour stream replay contains only 30 great moments | Mark each "hilarious moment" or "golden quote" and batch-export short videos |
| **Movie / TV series mashups** | Personal edits require pulling clips from multi-episode sources | Batch-check multiple episodes; every clip gets a clear name |
| **Video podcasts** | Only 5 segments of a 1-hour podcast suit short-video publishing | Mark + name + cover poster — produce 5 short videos in one pass |

### 📱 Self-media / UGC Batch Processing

| Scenario | Pain point | Tool capability |
|------|------|---------|
| **Batch watermarking** | Dozens of clips need a unified show/author watermark | Check in the table and batch-apply a large red-text watermark automatically |
| **Batch cover embedding** | Published videos need a cover poster (attached_pic) | Auto-generate a PNG temp cover → embed into mp4 → delete temp file |
| **Quality unification** | Source materials vary in quality and need unified 720p / 1080p | Choose "480p / HD / Standard / Smooth" for batch conversion |
| **Family / kids' highlights** | Hours of family footage where you only keep first steps, first words, etc. | Name watermarks like "First Steps", "First 'Mama'" — easy to share with family |

### 🚁 Other Long-video Trimming

| Scenario | Pain point | Tool capability |
|------|------|---------|
| **Wedding / event footage** | Hours of raw footage where only 30 minutes are worth sending to family | Mark key moments "Ceremony", "Toasts", "Group Photos" and batch-export |
| **Performances / concerts** | Hours of multi-camera footage where only the solo / encore matter | Stream copy keeps the original bitrate; ready to share right after export |
| **Surgery / experiment recording** (academic use) | Keep only key steps from long footage | Mark step names as watermarks, convenient for citing in papers |
| **GoPro / action cameras** | Long footage from frequent recordings with highlights scattered around | Mark + name + batch original-quality export |

> **Common thread**: the core need across all scenarios is "**precisely extract multiple clips from long footage + unified naming + batch output**" — exactly what this tool is best at.

## Lightweight by Design

Following the design principle of "**no feature bloat, no resource hogging**", the tool stays minimal across dependencies, runtime, and packaging:

### 📦 Installer Size Comparison (similar desktop editing tools)

| Tool | Installer size | Startup memory | Discrete GPU needed |
|------|-----------|---------|-----------|
| Adobe Premiere Pro | ~ 5 GB | 1.5 - 4 GB | ✅ Strongly recommended |
| Final Cut Pro | ~ 4 GB | 2 - 6 GB | ⚠️ macOS only, needs Apple Silicon |
| CapCut Desktop (Windows) | ~ 700 MB | 800 MB - 1.5 GB | ✅ Recommended |
| HandBrake | ~ 80 MB | 100 - 200 MB | ❌ Not needed |
| **BatchCut (this tool)** | **~ 60 - 90 MB** | **80 - 200 MB** | **❌ Not needed** |

### 🪶 Measured Resource Usage (Windows 11 / i5-8250U / integrated graphics)

| State | CPU usage | Memory usage | Disk IO |
|------|---------|---------|---------|
| Idle after startup | < 1% | 80 - 120 MB | 0 |
| Scanning 100 videos | 5 - 15% | 120 - 180 MB | Occasional reads |
| Original-quality stream-copy export | 1 - 5% | 130 - 200 MB | **Saturated sequential write** |
| Re-encode export (CRF 23) | 30 - 60% (single core maxed) | 150 - 250 MB | Moderate |

> 💡 **Key advantage**: in stream-copy mode the CPU only copies and concatenates — **export speed ≈ disk write speed**. A 5-minute 1080p clip exports in just seconds.

### 🚫 "Heavy" Capabilities Deliberately Dropped

| Not included | Why |
|------|------|
| ❌ Multi-track timeline | 90% of users only cut segments; multi-track is overkill |
| ❌ Filters / transitions / effects | Professional tools like CapCut / Premiere already cover this; not this tool's positioning |
| ❌ AI subtitles / AI editing | Bundling large models would inflate the installer by several GB, violating the "lightweight" principle |
| ❌ GPU hardware acceleration | Sacrificing compatibility for ~10% speed gains is not worthwhile for batch cutting |
| ❌ Bundled video decoding libraries | Uses system ffmpeg for decoding, keeping dependencies smaller |
| ❌ Account sync / database | Positioned as an offline local tool with zero network dependencies |

### 🧰 Dependency Strategy (no redundant bundled libraries)

| Category | Count | Notes |
|------|------|------|
| **Runtime dependencies** | Only **2** | `vue` + `naive-ui`, imported on demand — unused components never enter the bundle |
| **Dev dependencies** | 12 | Build toolchain: electron / electron-vite / vite / typescript / vue-tsc / electron-builder / @electron-toolkit, etc. |
| **System dependency** | 1 | `ffmpeg` + `ffprobe` are invoked from the user's system (environment variable or PATH), **not bundled**, avoiding an 80 MB+ installer bloat |
| **Not introduced** | 0 | ❌ No AI SDK / ❌ No database driver / ❌ No image-processing library / ❌ No cloud-sync SDK |

```jsonc
// Actual dependencies in package.json (trimmed to the extreme)
{
  "dependencies": {
    "vue": "^3.4.0",           // Vue 3 framework
    "naive-ui": "^2.39.0"       // On-demand UI component library
  }
}
```

> 🔋 **Lightweight philosophy**: save a line of code wherever possible; use system capabilities instead of bundling — keeping the tool in that sweet spot of "**install and it just works, close it when done**".

## Watermark Styles (Optional)

The clip-name watermark applied during cutting supports custom styles — switchable in a dialog without writing any code:

### 📍 Position (5 options)

| Option | drawtext expression | Best for |
|------|----------------|---------|
| **Top-left** | `x=20:y=20` | Show badge, author credit |
| **Top-right** | `x=w-text_w-20:y=20` | Timecode / episode number |
| **Center** | `x=(w-text_w)/2:y=(h-text_h)/2` (default) | Title emphasis (backward compatible) |
| **Bottom-left** | `x=20:y=h-text_h-20` | End-of-clip watermark |
| **Bottom-right** | `x=w-text_w-20:y=h-text_h-20` | TV-style logo, repost source |

### 🔤 Font Size (4 options)

| Level | drawtext expression | Actual pixels on 1080p video |
|------|----------------|-------------------|
| **Small** | `h/16` | ~68 px |
| **Medium** | `h/12` | ~90 px |
| **Large** (default) | `h/10` | ~108 px |
| **Extra large** | `h/8` | ~135 px |

> Font size adapts to video height by default: automatically larger on 4K videos, smaller on 480p, always visually consistent.

### 🎨 Color (8 presets)

| Name | Hex value | Look & feel |
|------|----------|------|
| 🔴 Red (default) | `0xFF0000` | Highly saturated, strong alert feel |
| 🟠 Orange | `0xFF8C00` | Eye-catching yet soft |
| 🟡 Yellow | `0xFFFF00` | Visible even on dark footage |
| 🟢 Green | `0x00C853` | Nature themes, outdoor sports |
| 🔵 Blue | `0x2196F3` | Tech, business style |
| 🟣 Purple | `0x9C27B0` | Artistic, entertainment |
| ⚪ White | `0xFFFFFF` | Best for dark/black footage |
| ⚫ Black | `0x000000` | Best for bright/white footage |

> 💡 Every color is paired with a **semi-transparent black background (box=black@0.6) + white outline (bordercolor=white@0.9) + shadow**, ensuring good readability on any footage.

## Output Rules

Each segment is output as `{original filename}_{clip name}.mp4`, e.g. `travel_Clip1.mp4`.
When a text watermark is applied, the cover is embedded into the mp4 as an `attached_pic` (visible as a poster in VLC and similar players); the temporary cover is deleted after embedding.

## Tech Stack

| Layer | Technology |
|------|------|
| Desktop framework | Electron 31 + electron-vite 2 |
| Frontend framework | Vue 3 + TypeScript |
| UI components | Naive UI |
| Video processing | FFmpeg 7.x (ffmpeg + ffprobe) |
| Build tooling | Vite 5 |
| Packaging | electron-builder |

## Prerequisite: FFmpeg

The application depends on the system's `ffmpeg` and `ffprobe`. Any of the following works:

1. **Environment variables**: set `FFMPEG_PATH` / `FFPROBE_PATH` to point to the executables
2. **PATH**: add them to the system `PATH`
3. **Common install directories** (auto-scanned): `D:\tools`, `C:\Program Files`, `C:\Program Files (x86)`, standard Linux/macOS paths

If not installed, the app shows an error at startup pointing to https://ffmpeg.org/download.html

### Automatic Detection at Startup

The app automatically detects whether `ffmpeg` / `ffprobe` are available at startup. If not found, a prompt appears and the user can open the built-in **FFmpeg installation tutorial** (`resources/FFmpeg安装教程.pdf`) with one click.

> Note: detection is informational only. You can click "Later" and keep using the UI, but scanning videos, cutting clips, applying watermarks, and generating covers require FFmpeg to be ready.

## Development & Build

### Install dependencies

```bash
npm install
```

### Start dev mode

```bash
npm run dev
```

### Type checking

```bash
npm run typecheck
```

### Package

```bash
# Current platform
npm run dist

# Windows
npm run dist:win

# macOS
npm run dist:mac
```

## Project Structure

```
BatchCut/
├── electron.vite.config.ts        # electron-vite configuration
├── package.json
├── tsconfig.json / .node.json / .web.json
├── resources/
│   └── icon.png                   # App icon (electron-builder auto-generates formats for Windows / macOS)
└── src/
    ├── main/                      # Electron main process
    │   ├── index.ts               # Main entry (window, media:// protocol, window controls, theme)
    │   ├── ipc/
    │   │   ├── index.ts           # IPC registration center
    │   │   └── video.ts           # Video-related IPC handlers
    │   └── services/
    │       └── videoService.ts    # Video business logic (FFmpeg orchestration, font resolution, stream copy/re-encode, cover embedding)
    ├── preload/
    │   ├── index.ts               # contextBridge, exposes only video / window / theme APIs
    │   └── index.d.ts             # window.api type definitions
    └── renderer/                  # Vue 3 renderer process
        ├── index.html
        └── src/
            ├── main.ts            # Entry
            ├── App.vue            # Single-page layout (title bar + header + main area)
            ├── assets/styles/global.css
            ├── components/
            │   └── TitleBar.vue   # Custom window title bar
            └── pages/
                └── VideoProcessor.vue  # Video processing main page
```

## Notes

- In Original (stream copy) mode, if the source video has abnormal timestamps the FFmpeg muxer may error out; the app automatically falls back to a CRF 18 re-encode retry
- 480p mode scales by height; width follows the aspect ratio and is forced to even numbers; sources below 480p are not upscaled
- Cross-segment cutting uses "output-side seek" for frame-accurate cutting; the re-encode path uses H.264 + AAC
- Text overlay relies on system fonts (Windows automatically looks for `msyh.ttc` / `msyhbd.ttc` / `simhei.ttf` / `simsun.ttc`); if not found, the watermark is skipped without blocking the workflow
