/* ==========================================================================
   KerupukTally AI - Core Logic & Precise Computer Vision Engine
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Element References
  const video = document.getElementById('webcam-feed');
  const canvas = document.getElementById('detection-canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  const cameraStatusText = document.getElementById('camera-status-text');
  const currentStreamName = document.getElementById('current-stream-name');
  const liveClock = document.getElementById('live-clock');

  // HUD & Counters
  const hudTargetVal = document.getElementById('hud-target-val');
  const hudCurrentVal = document.getElementById('hud-current-val');
  const countGoodEl = document.getElementById('count-good');
  const countDefectEl = document.getElementById('count-defect');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const currentCrateNumber = document.getElementById('current-crate-number');
  
  // Shift Stats
  const statTotalCrates = document.getElementById('stat-total-crates');
  const statTotalPcs = document.getElementById('stat-total-pcs');
  const statDefectRate = document.getElementById('stat-defect-rate');
  const statTotalWeight = document.getElementById('stat-total-weight');
  const shiftDateEl = document.getElementById('shift-date');
  
  // Buttons & Controls
  const btnSwitchCamera = document.getElementById('btn-switch-camera');
  const btnToggleDemo = document.getElementById('btn-toggle-demo');
  const btnManualAdd = document.getElementById('btn-manual-add');
  const btnManualReset = document.getElementById('btn-manual-reset');
  const btnQuickCrate = document.getElementById('btn-quick-crate');
  const btnWhatsappExport = document.getElementById('btn-whatsapp-export');
  const btnClearShift = document.getElementById('btn-clear-shift');
  
  // Modal Alert
  const basketFullOverlay = document.getElementById('basket-full-overlay');
  const btnDismissAlert = document.getElementById('btn-dismiss-alert');
  const audioBeep = document.getElementById('audio-beep');

  // Settings Inputs
  const inputTargetCapacity = document.getElementById('input-target-capacity');
  const inputAvgWeight = document.getElementById('input-avg-weight');
  const checkSoundAlert = document.getElementById('check-sound-alert');
  const inputSensitivity = document.getElementById('input-sensitivity');

  // System State
  let isDemoMode = false;
  let demoImage = null;
  let videoDevices = [];
  let currentDeviceIndex = 0;
  let targetCapacity = parseInt(inputTargetCapacity.value) || 125;
  let avgWeightGram = parseFloat(inputAvgWeight.value) || 15;
  let minBrightnessThreshold = parseInt(inputSensitivity?.value) || 185; // Raised threshold to prevent floor false-positives
  
  // Detection Memory & Manual Overrides
  let manualMarkers = [];
  let accumulatedGoodCount = 0;
  let detectedGoodCount = 0;
  let detectedDefectCount = 0;
  
  // Shift Persistent Data
  let shiftData = {
    totalCrates: 0,
    totalPcs: 0,
    totalDefects: 0,
    currentCrateIndex: 1
  };

  loadShiftData();
  updateLiveClock();
  setInterval(updateLiveClock, 1000);

  const today = new Date();
  shiftDateEl.textContent = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  // --------------------------------------------------------------------------
  // 1. Camera Initialization & Stream Handling
  // --------------------------------------------------------------------------
  async function initCamera() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (videoDevices.length === 0) {
        cameraStatusText.textContent = 'KAMERA TIDAK DITEMUKAN (DEMO MODE)';
        enableDemoMode();
        return;
      }

      let selectedDeviceId = videoDevices[0].deviceId;
      const backCam = videoDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
      if (backCam) {
        selectedDeviceId = backCam.deviceId;
      }

      startVideoStream(selectedDeviceId);
    } catch (err) {
      console.warn('Camera access denied or error:', err);
      cameraStatusText.textContent = 'MODE DEMO SAMPLE';
      enableDemoMode();
    }
  }

  async function startVideoStream(deviceId) {
    if (isDemoMode) isDemoMode = false;
    
    const constraints = {
      video: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      
      video.onloadedmetadata = () => {
        video.play();
        canvas.width = video.videoWidth || 800;
        canvas.height = video.videoHeight || 600;
        cameraStatusText.textContent = 'KAMERA LIVE ACTIVE';
        currentStreamName.textContent = `Overhead Stream (${video.videoWidth}x${video.videoHeight})`;
        requestAnimationFrame(processVideoFrame);
      };
    } catch (err) {
      console.error('Failed to start stream:', err);
      enableDemoMode();
    }
  }

  btnSwitchCamera.addEventListener('click', () => {
    if (videoDevices.length > 1) {
      currentDeviceIndex = (currentDeviceIndex + 1) % videoDevices.length;
      startVideoStream(videoDevices[currentDeviceIndex].deviceId);
    } else {
      enableDemoMode();
    }
  });

  // --------------------------------------------------------------------------
  // 2. Demo Sample Mode
  // --------------------------------------------------------------------------
  function enableDemoMode() {
    isDemoMode = true;
    cameraStatusText.textContent = 'MODE UJI DEMO SAMPLING';
    currentStreamName.textContent = 'Simulasi Hamparan Kerupuk Pabrik';
    
    canvas.width = 900;
    canvas.height = 675;

    generateSyntheticKerupukSample();
  }

  btnToggleDemo.addEventListener('click', () => {
    enableDemoMode();
  });

  function generateSyntheticKerupukSample() {
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = 900;
    bgCanvas.height = 675;
    const bgCtx = bgCanvas.getContext('2d');

    bgCtx.fillStyle = '#1e2025';
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

    const rows = 9;
    const cols = 10;
    const radius = 28;
    
    manualMarkers = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = 75 + c * 80 + (Math.random() * 10 - 5);
        const y = 75 + r * 65 + (Math.random() * 8 - 4);
        const isDefect = (r === 2 && c === 3) || (r === 6 && c === 7);

        manualMarkers.push({
          x: Math.round(x),
          y: Math.round(y),
          radius: radius + Math.random() * 4 - 2,
          isGood: !isDefect
        });
      }
    }

    demoImage = bgCanvas;
    renderDemoFrame();
  }

  function renderDemoFrame() {
    if (!isDemoMode) return;

    ctx.fillStyle = '#181b22';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 12;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    let goodCount = accumulatedGoodCount;
    let defectCount = 0;

    manualMarkers.forEach(m => {
      ctx.save();
      ctx.beginPath();
      
      if (m.isGood) {
        ctx.arc(m.x, m.y, m.radius || 26, 0, Math.PI * 2);
        ctx.fillStyle = '#f1f5f9';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#cbd5e1';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(m.x, m.y, (m.radius || 26) + 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        ctx.stroke();

        goodCount++;
      } else {
        ctx.ellipse(m.x, m.y, (m.radius || 26) * 0.8, (m.radius || 26) * 0.5, Math.PI / 4, 0, Math.PI * 2);
        ctx.fillStyle = '#f87171';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(m.x, m.y, (m.radius || 26) + 6, 0, Math.PI * 2);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillStyle = '#ef4444';
        ctx.fillText('🔴 CACAT', m.x - 22, m.y + (m.radius || 26) + 16);

        defectCount++;
      }
      ctx.restore();
    });

    updateCounters(goodCount, defectCount);
  }

  // --------------------------------------------------------------------------
  // 3. Precise Computer Vision & ROI Filtering (Prevents Floor False Positives)
  // --------------------------------------------------------------------------
  function processVideoFrame() {
    if (isDemoMode) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Define Basket Region of Interest (ROI) - Ignore outer floor area (outer 12% margin)
      const roiMarginX = Math.round(canvas.width * 0.10);
      const roiMarginY = Math.round(canvas.height * 0.10);
      const roiWidth = canvas.width - (roiMarginX * 2);
      const roiHeight = canvas.height - (roiMarginY * 2);

      // Draw ROI Boundary Box for Operator Visual Guidance
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.strokeRect(roiMarginX, roiMarginY, roiWidth, roiHeight);
      ctx.setLineDash([]);

      ctx.font = 'bold 12px Outfit, sans-serif';
      ctx.fillStyle = '#06b6d4';
      ctx.fillText('🎯 AREA HITUNG KERANJANG (ROI)', roiMarginX + 10, roiMarginY + 22);

      // Process image data strictly inside ROI box
      const frameData = ctx.getImageData(roiMarginX, roiMarginY, roiWidth, roiHeight);
      const detectedBlobs = analyzeKerupukFrame(frameData, roiMarginX, roiMarginY);

      let goodCount = accumulatedGoodCount;
      let defectCount = 0;

      detectedBlobs.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        
        if (b.isGood) {
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 3;
          ctx.stroke();
          goodCount++;
        } else {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 4;
          ctx.stroke();

          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.fillStyle = '#ef4444';
          ctx.fillText('🔴 CACAT', b.x - 20, b.y + b.radius + 14);
          defectCount++;
        }
      });

      manualMarkers.forEach(m => {
        ctx.beginPath();
        ctx.arc(m.x, m.y, 22, 0, Math.PI * 2);
        if (m.isGood) {
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 4;
          ctx.stroke();
          goodCount++;
        } else {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 4;
          ctx.stroke();
          defectCount++;
        }
      });

      updateCounters(goodCount, defectCount);
    }

    requestAnimationFrame(processVideoFrame);
  }

  // Precise Blob & Contrast Filter
  function analyzeKerupukFrame(imageData, offsetX, offsetY) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    // Adaptive step size based on resolution
    const step = Math.max(28, Math.round(width / 32));
    const blobs = [];
    const minLuminance = minBrightnessThreshold; // User adjustable sensitivity

    for (let y = step; y < height - step; y += step) {
      for (let x = step; x < width - step; x += step) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

        // Must be significantly brighter than dark floor background
        if (luminance > minLuminance) {
          // Check local peak contrast (kerupuk white center vs edge)
          const leftIdx = (y * width + (x - 10)) * 4;
          const rightIdx = (y * width + (x + 10)) * 4;
          const leftLum = 0.299 * data[leftIdx] + 0.587 * data[leftIdx+1] + 0.114 * data[leftIdx+2];
          const rightLum = 0.299 * data[rightIdx] + 0.587 * data[rightIdx+1] + 0.114 * data[rightIdx+2];

          // Contrast peak check to ensure it's a real white kerupuk object
          if (luminance >= leftLum && luminance >= rightLum) {
            const isGoodShape = (r > 165 && g > 165 && Math.abs(r - g) < 25);
            
            // Distance suppression (minimum 36px separation between kerupuk centers)
            const isDuplicate = blobs.some(blob => Math.hypot(blob.x - (x + offsetX), blob.y - (y + offsetY)) < 36);
            if (!isDuplicate) {
              blobs.push({
                x: x + offsetX,
                y: y + offsetY,
                radius: 24,
                isGood: isGoodShape
              });
            }
          }
        }
      }
    }

    return blobs;
  }

  // --------------------------------------------------------------------------
  // 4. Interactive Touch Control
  // --------------------------------------------------------------------------
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const tapX = (e.clientX - rect.left) * scaleX;
    const tapY = (e.clientY - rect.top) * scaleY;

    const defectIndex = manualMarkers.findIndex(m => !m.isGood && Math.hypot(m.x - tapX, m.y - tapY) < 35);

    if (defectIndex !== -1) {
      manualMarkers.splice(defectIndex, 1);
    } else {
      const existingIndex = manualMarkers.findIndex(m => Math.hypot(m.x - tapX, m.y - tapY) < 30);
      if (existingIndex !== -1) {
        manualMarkers.splice(existingIndex, 1);
      } else {
        manualMarkers.push({
          x: Math.round(tapX),
          y: Math.round(tapY),
          radius: 24,
          isGood: true
        });
      }
    }

    if (isDemoMode) {
      renderDemoFrame();
    }
  });

  // --------------------------------------------------------------------------
  // 5. Counters & Zero-Defect Enforcement
  // --------------------------------------------------------------------------
  function updateCounters(goodCount, defectCount) {
    detectedGoodCount = goodCount;
    detectedDefectCount = defectCount;

    hudCurrentVal.textContent = goodCount;
    countGoodEl.textContent = goodCount;
    countDefectEl.textContent = defectCount;

    const percentage = Math.min(100, Math.round((goodCount / targetCapacity) * 100));
    progressBarFill.style.width = `${percentage}%`;

    if (defectCount > 0) {
      cameraStatusText.textContent = `⚠️ KUNCI QC: ADA ${defectCount} KERUPUK CACAT! AMBIL DAHULU`;
      cameraStatusText.parentElement.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
      cameraStatusText.parentElement.style.color = '#ef4444';
    } else {
      cameraStatusText.textContent = isDemoMode ? 'MODE UJI DEMO SAMPLING' : 'KAMERA LIVE ACTIVE';
      cameraStatusText.parentElement.style.backgroundColor = 'rgba(16, 185, 129, 0.12)';
      cameraStatusText.parentElement.style.color = '#10b981';
    }

    if (goodCount >= targetCapacity && defectCount === 0 && basketFullOverlay.classList.contains('hidden')) {
      triggerBasketFullAlert();
    }
  }

  function triggerBasketFullAlert() {
    basketFullOverlay.classList.remove('hidden');
    
    if (checkSoundAlert.checked) {
      audioBeep.play().catch(e => console.log('Audio autoplay blocked:', e));
    }

    recordCrateToShift(targetCapacity, 0);
  }

  btnDismissAlert.addEventListener('click', () => {
    basketFullOverlay.classList.add('hidden');
    manualMarkers = [];
    accumulatedGoodCount = 0;
    shiftData.currentCrateIndex++;
    currentCrateNumber.textContent = `Keranjang #${shiftData.currentCrateIndex}`;
    saveShiftData();

    if (isDemoMode) {
      generateSyntheticKerupukSample();
    }
  });

  btnManualAdd.addEventListener('click', () => {
    updateCounters(detectedGoodCount + 1, detectedDefectCount);
  });

  btnManualReset.addEventListener('click', () => {
    manualMarkers = [];
    accumulatedGoodCount = 0;
    updateCounters(0, 0);
    if (isDemoMode) renderDemoFrame();
  });

  btnQuickCrate.addEventListener('click', () => {
    recordCrateToShift(targetCapacity, 0);
    shiftData.currentCrateIndex++;
    currentCrateNumber.textContent = `Keranjang #${shiftData.currentCrateIndex}`;
    saveShiftData();
    alert(`✅ 1 Keranjang Full (${targetCapacity} Pcs 100% Zero-Defect) Berhasil Ditambahkan!`);
  });

  // Sensitivity Slider Listener
  if (inputSensitivity) {
    inputSensitivity.addEventListener('input', (e) => {
      minBrightnessThreshold = parseInt(e.target.value) || 185;
    });
  }

  // --------------------------------------------------------------------------
  // 6. Shift Data & LocalStorage
  // --------------------------------------------------------------------------
  function recordCrateToShift(pcs, defects) {
    shiftData.totalCrates += 1;
    shiftData.totalPcs += pcs;
    shiftData.totalDefects += defects;
    saveShiftData();
  }

  function saveShiftData() {
    localStorage.setItem('kerupuk_tally_shift_data', JSON.stringify(shiftData));
    renderShiftMetrics();
  }

  function loadShiftData() {
    const saved = localStorage.getItem('kerupuk_tally_shift_data');
    if (saved) {
      try {
        shiftData = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved shift data', e);
      }
    }
    renderShiftMetrics();
  }

  function renderShiftMetrics() {
    statTotalCrates.innerHTML = `${shiftData.totalCrates} <small>Keranjang</small>`;
    statTotalPcs.innerHTML = `${shiftData.totalPcs.toLocaleString('id-ID')} <small>Pcs</small>`;
    currentCrateNumber.textContent = `Keranjang #${shiftData.currentCrateIndex || (shiftData.totalCrates + 1)}`;

    const totalProcessed = shiftData.totalPcs + shiftData.totalDefects;
    const defectRate = totalProcessed > 0 ? ((shiftData.totalDefects / totalProcessed) * 100).toFixed(1) : '0.0';
    statDefectRate.textContent = `${defectRate}%`;

    const weightKg = ((shiftData.totalPcs * avgWeightGram) / 1000).toFixed(1);
    statTotalWeight.innerHTML = `${weightKg} <small>kg</small>`;
  }

  btnClearShift.addEventListener('click', () => {
    if (confirm('Apakah Anda yakin ingin mereset seluruh catatan shift hari ini?')) {
      shiftData = {
        totalCrates: 0,
        totalPcs: 0,
        totalDefects: 0,
        currentCrateIndex: 1
      };
      saveShiftData();
    }
  });

  inputTargetCapacity.addEventListener('change', (e) => {
    targetCapacity = parseInt(e.target.value) || 125;
    hudTargetVal.innerHTML = `${targetCapacity} <small>PCS</small>`;
    updateCounters(detectedGoodCount, detectedDefectCount);
  });

  inputAvgWeight.addEventListener('change', (e) => {
    avgWeightGram = parseFloat(e.target.value) || 15;
    renderShiftMetrics();
  });

  // --------------------------------------------------------------------------
  // 7. WhatsApp Export Generator
  // --------------------------------------------------------------------------
  btnWhatsappExport.addEventListener('click', () => {
    const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const weightKg = ((shiftData.totalPcs * avgWeightGram) / 1000).toFixed(1);
    const totalProcessed = shiftData.totalPcs + shiftData.totalDefects;
    const defectRate = totalProcessed > 0 ? ((shiftData.totalDefects / totalProcessed) * 100).toFixed(1) : '0.0';

    const message = 
`📋 *LAPORAN HASIL PRODUKSI PABRIK KERUPUK*
📅 *Tanggal:* ${todayStr}
----------------------------------
📦 *Total Keranjang Penuh:* ${shiftData.totalCrates} Keranjang (100% Zero-Defect)
🫓 *Total Kerupuk Lulus (OK):* ${shiftData.totalPcs.toLocaleString('id-ID')} Pcs
🔴 *Kerupuk Cacat Dibuang (QC):* ${shiftData.totalDefects} Pcs (Defect Rate: ${defectRate}%)
⚖️ *Estimasi Berat Produksi:* ${weightKg} kg
----------------------------------
_Laporan otomatis dibuat oleh KerupukTally AI System_`;

    const encodedMsg = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMsg}`, '_blank');
  });

  function updateLiveClock() {
    const now = new Date();
    liveClock.textContent = now.toLocaleTimeString('id-ID');
  }

  initCamera();
});
