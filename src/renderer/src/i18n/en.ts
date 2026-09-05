const en = {
  // ---------- Document / Title Bar ----------
  'app.documentTitle': 'Batch Cut',
  'app.name': 'Batch Cut',
  'app.headerTitle': 'Batch Video Cut',

  // ---------- Window Controls ----------
  'titlebar.minimize': 'Minimize',
  'titlebar.restore': 'Restore Down',
  'titlebar.maximize': 'Maximize',
  'titlebar.close': 'Close',

  // ---------- Language / Theme ----------
  'app.switchLang': '中文',
  'app.langHint': 'Switch language / 切换语言',
  'theme.system': 'System',
  'theme.dark': 'Dark',
  'theme.light': 'Light',
  'theme.popoverHint': 'Click to cycle: System → Light → Dark',

  // ---------- FFmpeg ----------
  'ffmpeg.missingTitle': 'FFmpeg Not Detected',
  'ffmpeg.missingHeader': 'Video clipping requires FFmpeg',
  'ffmpeg.missingBody':
    'This tool needs ffmpeg and ffprobe to scan video info, cut segments, overlay watermarks and generate covers. FFmpeg was not found on this machine. Please install it first.',
  'ffmpeg.later': 'Later',
  'ffmpeg.viewGuide': 'View Install Guide',

  // ---------- FFmpeg Install Guide Modal ----------
  'guide.title': 'FFmpeg Installation Guide',
  'guide.step1.title': 'Open the download page',
  'guide.step1.body':
    'Open https://github.com/BtbN/FFmpeg-Builds/releases in your browser — it hosts prebuilt Windows binaries of FFmpeg.',
  'guide.step2.title': 'Download the binary archive',
  'guide.step2.body':
    'Download the Windows binary archive from the page, e.g. ffmpeg-master-latest-win64-gpl.zip.',
  'guide.step2.imgAlt': 'Screenshot of the binary archive download',
  'guide.step3.title': 'Extract it under D:\\tools\\',
  'guide.step3.body':
    'Extract the archive under D:\\tools\\ — no environment variable setup is needed; this app automatically scans',
  'guide.step3.imgAlt': 'Screenshot of extracting under D:\\tools\\',
  'guide.note':
    'Restart Batch Cut after installation, and FFmpeg will be detected automatically.',
  'guide.openDownloadPage': 'Open Download Page',
  'guide.done': 'Done',

  // ---------- Folder & Video List ----------
  'vp.selectFolder': 'Select Folder',
  'vp.rescan': 'Rescan',
  'vp.clear': 'Clear',
  'vp.clearConfirm': 'Clear the current video list and all marked segments? This cannot be undone.',
  'vp.videoCount': '{n} videos',
  'vp.emptyHint': 'Select a folder containing videos first',
  'vp.listTitle': 'Video List',
  'vp.col.name': 'File Name',
  'vp.col.duration': 'Duration',
  'vp.col.resolution': 'Resolution',
  'vp.col.size': 'Size',
  'vp.col.marks': 'Marks',
  'vp.col.actions': 'Actions',
  'vp.marksCount': '{n} segs',
  'vp.unmarked': 'None',
  'vp.playMark': 'Play / Mark',
  'vp.clip': 'Clip',
  'vp.selectedInfo': '{videos} videos / {marks} marks selected',
  'vp.batchClip': 'Batch Clip (Selected)',
  'vp.batchHint':
    'Tip: check rows in the table then click Batch Clip; each row needs segments added via "Play / Mark" first',

  // ---------- Messages ----------
  'vp.msgCleared': 'Video list and mark data cleared',
  'vp.msgScanned': 'Found {n} videos',
  'vp.msgNoVideo': 'No video files found in this folder',
  'vp.msgScanFail': 'Scan failed: {err}',
  'vp.msgStartMarked': 'Start point marked: {time}',
  'vp.msgMarkStartFirst': 'Click "Mark Start" first',
  'vp.msgEndAfterStart': 'End time must be greater than start time. Drag the progress bar or keep playing first',
  'vp.msgMarkAdded': 'Segment added: {start} ~ {end}',
  'vp.msgInvalidMark': 'Invalid segment found (end time must be greater than start time)',
  'vp.msgMarksSaved': 'Saved {n} marked segments',
  'vp.msgNoMarksSingle': 'This video has no marked segments yet. Use "Play / Mark" to add some first',
  'vp.msgNoMarksBatch': 'Check at least one video that has marked segments',
  'vp.msgPickOutputDir': 'Please choose an output folder',
  'vp.msgOpenFolderFail': 'Failed to open folder: {err}',
  'vp.msgFileError': '{name}: {err}',

  // ---------- Player / Mark Modal ----------
  'vp.playerTitle': 'Video Playback & Segment Marking',
  'vp.shortcuts': 'Keys: [ mark start · ] mark end',
  'vp.markStart': 'Mark Start',
  'vp.markEnd': 'Mark End',
  'vp.startAt': 'Start: {time}',
  'vp.noStart': 'No start point',
  'vp.currentTime': '{cur} / {total}',
  'vp.playerHint':
    'Click "Mark Start" and "Mark End" while playing to add a clip range; multiple ranges are allowed. Times and names can be edited in the list below.',
  'vp.segmentList': 'Segments ({n})',
  'vp.markNamePlaceholder': 'Segment name',
  'vp.markDuration': 'Duration {d}',
  'vp.delete': 'Delete',
  'vp.emptyMarks': 'No segments yet. Play the video, then use "Mark Start / Mark End" to add some',
  'vp.defaultMarkName': 'Clip {n}',
  'vp.cancel': 'Cancel',
  'vp.saveMarks': 'Save Marks',

  // ---------- Clip Settings Modal ----------
  'vp.clipSettings': 'Clip Settings',
  'vp.clipTargets': 'Targets',
  'vp.clipSummarySingle': '{videos} video(s) · {segs} segment(s)',
  'vp.clipSummaryBatch': '{videos} video(s) · {segs} segment(s) (videos without marks are skipped)',
  'vp.outputQuality': 'Output Quality',
  'vp.quality.original': 'Original (lossless, fastest, start aligned to keyframe)',
  'vp.quality.p480': '480p (scaled to 480p, smaller size)',
  'vp.quality.high': 'HD (H.264 CRF 18)',
  'vp.quality.medium': 'Standard (H.264 CRF 23)',
  'vp.quality.low': 'Smooth (H.264 CRF 28)',
  'vp.burnText': 'Burn Segment Name',
  'vp.burnHint':
    'Overlay the segment name as a watermark on the picture (shown for the first 2 seconds) and embed it as the video cover (shown as a poster in players like VLC)',
  'vp.originalNote': '(Original mode will be re-encoded to overlay the text)',
  'vp.watermarkPosition': 'Watermark Position',
  'vp.pos.topLeft': 'Top Left',
  'vp.pos.topRight': 'Top Right',
  'vp.pos.center': 'Center',
  'vp.pos.bottomLeft': 'Bottom Left',
  'vp.pos.bottomRight': 'Bottom Right',
  'vp.fontSize': 'Font Size',
  'vp.font.small': 'Small (h/16)',
  'vp.font.medium': 'Medium (h/12)',
  'vp.font.large': 'Large (h/10)',
  'vp.font.xlarge': 'Extra Large (h/8)',
  'vp.color': 'Color',
  'vp.color.red': '🔴 Red',
  'vp.color.orange': '🟠 Orange',
  'vp.color.yellow': '🟡 Yellow',
  'vp.color.green': '🟢 Green',
  'vp.color.blue': '🔵 Blue',
  'vp.color.purple': '🟣 Purple',
  'vp.color.white': '⚪ White',
  'vp.color.black': '⚫ Black',
  'vp.outputDir': 'Output Folder',
  'vp.noOutputDir': 'No output folder selected',
  'vp.chooseDir': 'Choose Folder',
  'vp.startClip': 'Start Clipping',

  // ---------- Progress / Result ----------
  'vp.progressTitle': 'Clipping Progress',
  'vp.overallProgress': 'Overall: video {cur} / {total}',
  'vp.progressText': 'Clipping: {file} · segment {cur}/{total}',
  'vp.preparing': 'Preparing…',
  'vp.clipDone': 'Done: {ok} segment(s) succeeded, {fail} failed',
  'vp.failReasons': 'Failures:',
  'vp.done': 'Done',
  'vp.openOutputFolder': 'Open Output Folder'
}

export default en
