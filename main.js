/* ===================================================================
   BIOHYGIENE OS - JAVASCRIPT LOGIC ENGINE
   Real-Time Biomedical Telemetry, ECG Canvas, and Hygiene Tracking
   =================================================================== */

// Global State
const state = {
  viewMode: 'dual', // 'web' | 'mobile' | 'dual'
  activeMobileTab: 'tab-mob-home',
  
  // Biomedical Vitals
  vitals: {
    heartRate: 74,
    spo2: 98,
    temp: 36.8,
    bpSys: 120,
    bpDia: 80,
    hygieneScore: 94,
    infectionRisk: 'Low (4.2%)',
    isAnomaly: false
  },

  // ECG Scope State
  ecg: {
    frozen: false,
    sweepSpeed: 2.2, // pixels per frame
    currentX: 0,
    lastY: 105,
    sampleIndex: 0
  },

  // WHO Handwash Timer State
  washTimer: {
    totalDuration: 20,
    remaining: 20,
    timerId: null,
    active: false,
    steps: [
      { num: 'Step 1 of 6', title: 'Rub hands palm to palm', desc: 'Create rich lather across palm surfaces using disinfectant soap.' },
      { num: 'Step 2 of 6', title: 'Right palm over left dorsum', desc: 'Interlace fingers and scrub the back of each hand thoroughly.' },
      { num: 'Step 3 of 6', title: 'Palm to palm with fingers interlaced', desc: 'Scrub interdigital webbing where pathogens harbor.' },
      { num: 'Step 4 of 6', title: 'Backs of fingers to opposing palms', desc: 'Lock fingers and scrub nail beds against opposite palm.' },
      { num: 'Step 5 of 6', title: 'Rotational rubbing of thumbs', desc: 'Clasp left thumb in right palm and rotate; repeat for right.' },
      { num: 'Step 6 of 6', title: 'Rotational rubbing of fingertips', desc: 'Clean subungual spaces under nails in circular motions.' }
    ]
  }
};

// ===================================================================
// INITIALIZATION
// ===================================================================

document.addEventListener('DOMContentLoaded', () => {
  initViewModes();
  initECGCanvas();
  initVitalsSimulation();
  initMobileNavigation();
  initWashTimer();
  initSOSModal();
  initHardwareControls();
  startClock();
});

// ===================================================================
// PRESENTATION VIEW MODE SWITCHER (Web / Mobile / Dual)
// ===================================================================

function initViewModes() {
  const btnWeb = document.getElementById('view-mode-web');
  const btnMob = document.getElementById('view-mode-mobile');
  const btnDual = document.getElementById('view-mode-dual');

  function setMode(mode) {
    state.viewMode = mode;
    document.body.className = `dark-theme view-${mode}`;
    
    [btnWeb, btnMob, btnDual].forEach(b => b.classList.remove('active'));
    if (mode === 'web') btnWeb.classList.add('active');
    if (mode === 'mobile') btnMob.classList.add('active');
    if (mode === 'dual') btnDual.classList.add('active');

    // Resize ECG canvas smoothly after layout transition
    setTimeout(resizeECGCanvas, 150);
  }

  btnWeb.addEventListener('click', () => setMode('web'));
  btnMob.addEventListener('click', () => setMode('mobile'));
  btnDual.addEventListener('click', () => setMode('dual'));

  // Default to Dual Mode for maximum showcase impact
  setMode('dual');
}

// ===================================================================
// REAL-TIME BIOMEDICAL LEAD II ECG OSCILLOSCOPE
// ===================================================================

function initECGCanvas() {
  const canvas = document.getElementById('ecgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight || 200;
  }
  window.addEventListener('resize', resize);
  resize();

  const btnFreeze = document.getElementById('btn-ecg-freeze');
  if (btnFreeze) {
    btnFreeze.addEventListener('click', () => {
      state.ecg.frozen = !state.ecg.frozen;
      btnFreeze.innerHTML = state.ecg.frozen 
        ? `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Resume Trace`
        : `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Freeze Trace`;
      showToast(state.ecg.frozen ? 'ECG Telemetry Trace Frozen' : 'ECG Telemetry Resumed');
    });
  }

  const btnSpeed = document.getElementById('btn-ecg-speed');
  if (btnSpeed) {
    const speeds = [
      { label: '25 mm/s', rate: 2.2 },
      { label: '50 mm/s', rate: 4.4 },
      { label: '12.5 mm/s', rate: 1.1 }
    ];
    let speedIdx = 0;
    btnSpeed.addEventListener('click', () => {
      speedIdx = (speedIdx + 1) % speeds.length;
      state.ecg.sweepSpeed = speeds[speedIdx].rate;
      btnSpeed.textContent = speeds[speedIdx].label;
      const rateLabel = document.querySelector('.ecg-meta-rate');
      if (rateLabel) {
        rateLabel.textContent = `Sweep: ${speeds[speedIdx].label} • Gain: 10 mm/mV • Lead II (Biopotential Patch)`;
      }
      showToast(`ECG Sweep Speed Adjusted to ${speeds[speedIdx].label}`);
    });
  }

  // Generate synthetic Lead-II P-QRS-T complex
  function getECGVoltage(sample, isTachycardia) {
    const period = isTachycardia ? 45 : 75; // Shorter period = higher HR
    const phase = sample % period;
    const midY = canvas.height / 2;

    // Normal baseline noise
    let val = (Math.sin(sample * 0.15) * 1.5) + (Math.random() * 0.8 - 0.4);

    if (phase >= 12 && phase <= 20) {
      // P-wave (Atrial Depolarization)
      val += Math.sin((phase - 12) / 8 * Math.PI) * 12;
    } else if (phase >= 23 && phase <= 25) {
      // Q-wave (Septal Depolarization)
      val -= 10;
    } else if (phase >= 26 && phase <= 30) {
      // R-wave (Ventricular Depolarization Spike)
      val += 72 * Math.sin((phase - 25) / 5 * Math.PI);
    } else if (phase >= 31 && phase <= 33) {
      // S-wave
      val -= 20;
    } else if (phase >= 40 && phase <= 54) {
      // T-wave (Ventricular Repolarization)
      val += Math.sin((phase - 40) / 14 * Math.PI) * 18;
    }

    return midY - val;
  }

  // Continuous animation loop
  function drawECG() {
    if (!state.ecg.frozen) {
      const step = state.ecg.sweepSpeed;
      const nextX = state.ecg.currentX + step;
      const targetY = getECGVoltage(state.ecg.sampleIndex, state.vitals.isAnomaly);

      // Erase ahead of the phosphor sweep
      ctx.fillStyle = '#02060c';
      ctx.fillRect(state.ecg.currentX, 0, 16, canvas.height);

      // Draw phosphor green trace
      ctx.beginPath();
      ctx.strokeStyle = state.vitals.isAnomaly ? '#f87171' : '#22c55e';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.shadowColor = state.vitals.isAnomaly ? '#ef4444' : '#22c55e';
      ctx.shadowBlur = 8;
      ctx.moveTo(state.ecg.currentX, state.ecg.lastY);
      ctx.lineTo(nextX, targetY);
      ctx.stroke();

      state.ecg.currentX = nextX;
      state.ecg.lastY = targetY;
      state.ecg.sampleIndex++;

      // Wrap around canvas width
      if (state.ecg.currentX >= canvas.width) {
        state.ecg.currentX = 0;
        state.ecg.lastY = canvas.height / 2;
      }
    }

    requestAnimationFrame(drawECG);
  }

  requestAnimationFrame(drawECG);
}

function resizeECGCanvas() {
  const canvas = document.getElementById('ecgCanvas');
  if (canvas && canvas.parentElement) {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight || 200;
  }
}

// ===================================================================
// VITALS SYNCHRONIZATION (Web & Mobile Real-time Linking)
// ===================================================================

function initVitalsSimulation() {
  // Micro-fluctuations every 2.5s to feel alive
  setInterval(() => {
    if (state.vitals.isAnomaly) return; // Keep anomaly steady when triggered

    // Micro natural pulse drift +/- 1 BPM
    const hrDelta = Math.random() > 0.5 ? 1 : -1;
    state.vitals.heartRate = Math.min(82, Math.max(68, state.vitals.heartRate + hrDelta));

    // SpO2 occasional flicker between 98 and 99
    state.vitals.spo2 = Math.random() > 0.85 ? 99 : 98;

    updateVitalsUI();
  }, 2500);

  // Trigger Anomaly simulation button
  const btnAnomaly = document.getElementById('btn-trigger-anomaly');
  const btnNormalize = document.getElementById('btn-normalize-vitals');

  if (btnAnomaly) {
    btnAnomaly.addEventListener('click', () => {
      state.vitals.isAnomaly = true;
      state.vitals.heartRate = 138;
      state.vitals.spo2 = 91;
      state.vitals.temp = 38.6;
      state.vitals.bpSys = 148;
      state.vitals.bpDia = 94;
      state.vitals.infectionRisk = 'High (34.8%)';
      updateVitalsUI();
      showToast('⚠️ Simulated Alert: Sinus Tachycardia & Febrile Spike Triggered!');
    });
  }

  if (btnNormalize) {
    btnNormalize.addEventListener('click', () => {
      state.vitals.isAnomaly = false;
      state.vitals.heartRate = 74;
      state.vitals.spo2 = 98;
      state.vitals.temp = 36.8;
      state.vitals.bpSys = 120;
      state.vitals.bpDia = 80;
      state.vitals.infectionRisk = 'Low (4.2%)';
      updateVitalsUI();
      showToast('✅ Vitals Normalized to Standard Baseline');
    });
  }
}

function updateVitalsUI() {
  // Web Dashboard elements (Segment 1: Telemetry)
  const webHR = document.getElementById('web-val-hr');
  const webSpO2 = document.getElementById('web-val-spo2');
  const webTemp = document.getElementById('web-val-temp');
  const webBP = document.getElementById('web-val-bp');
  const webHygiene = document.getElementById('web-val-hygiene');
  const webRisk = document.getElementById('web-val-risk');
  const ecgBpm = document.getElementById('ecg-live-bpm');
  const cardHR = document.getElementById('card-heart-rate');
  const cardSpO2 = document.getElementById('card-spo2');
  const aiBox = document.getElementById('ai-insight-box-extended');

  // Mobile App elements
  const mobHR = document.getElementById('mob-val-hr');
  const mobSpO2 = document.getElementById('mob-val-spo2');
  const mobTemp = document.getElementById('mob-val-temp');
  const mobBP = document.getElementById('mob-val-bp');

  // EMR Table elements
  const tblVitals = document.getElementById('tbl-vitals-p104');

  // Segment 5 AI Models
  const news2Val = document.getElementById('news2-score-val');
  const news2Pill = document.getElementById('news2-pill');
  const news2Bar = document.getElementById('news2-bar');
  const sepsisVal = document.getElementById('sepsis-score-val');
  const sepsisPill = document.getElementById('sepsis-pill');
  const sepsisBar = document.getElementById('sepsis-bar');
  const arrhythmiaPill = document.getElementById('arrhythmia-pill');
  const arrConf = document.getElementById('arrhythmia-conf-val');

  if (webHR) webHR.textContent = state.vitals.heartRate;
  if (webSpO2) webSpO2.textContent = state.vitals.spo2;
  if (webTemp) webTemp.textContent = state.vitals.temp;
  if (webBP) webBP.textContent = `${state.vitals.bpSys}/${state.vitals.bpDia}`;
  if (webHygiene) webHygiene.textContent = state.vitals.hygieneScore;
  if (webRisk) webRisk.textContent = state.vitals.infectionRisk.split(' ')[0];
  if (ecgBpm) ecgBpm.textContent = state.vitals.heartRate;

  if (mobHR) mobHR.textContent = state.vitals.heartRate;
  if (mobSpO2) mobSpO2.textContent = state.vitals.spo2;
  if (mobTemp) mobTemp.textContent = state.vitals.temp;
  if (mobBP) mobBP.textContent = `${state.vitals.bpSys}/${state.vitals.bpDia}`;

  if (tblVitals) {
    tblVitals.textContent = `${state.vitals.heartRate} BPM • ${state.vitals.spo2}% SpO2`;
    tblVitals.className = state.vitals.isAnomaly ? 'v-pill warn' : 'v-pill ok';
  }

  // Anomaly Visuals Synchronization Across All Segments
  if (state.vitals.isAnomaly) {
    cardHR?.classList.add('critical-alert');
    cardSpO2?.classList.add('critical-alert');
    const hrStatus = document.getElementById('web-status-hr');
    if (hrStatus) {
      hrStatus.textContent = 'Tachycardia Alert!';
      hrStatus.className = 'vital-status-pill danger';
    }
    const spo2Status = document.getElementById('web-status-spo2');
    if (spo2Status) {
      spo2Status.textContent = 'Mild Hypoxia';
      spo2Status.className = 'vital-status-pill danger';
    }

    // Segment 5 AI Early Warning Spike
    if (news2Val) news2Val.innerHTML = `8 <small>/ 20</small>`;
    if (news2Pill) {
      news2Pill.textContent = 'Score: 8 (High Risk Alert)';
      news2Pill.className = 'vital-status-pill danger';
    }
    if (news2Bar) {
      news2Bar.style.width = '70%';
      news2Bar.className = 'model-fill red';
    }
    if (sepsisVal) sepsisVal.innerHTML = `2 <small>/ 3</small>`;
    if (sepsisPill) {
      sepsisPill.textContent = 'Positive qSOFA (2/3)';
      sepsisPill.className = 'vital-status-pill danger';
    }
    if (sepsisBar) {
      sepsisBar.style.width = '66%';
      sepsisBar.className = 'model-fill red';
    }
    if (arrhythmiaPill) {
      arrhythmiaPill.textContent = 'Sinus Tachycardia';
      arrhythmiaPill.className = 'vital-status-pill danger';
    }
    if (arrConf) arrConf.innerHTML = `98.6% <small>Confidence</small>`;

    if (aiBox) {
      aiBox.innerHTML = `
        <div class="ai-badge-row">
          <span class="ai-badge danger" style="background: rgba(239, 68, 68, 0.2); color: #f87171;">Tachycardia Detected (138 BPM)</span>
          <span class="ai-badge danger" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24;">Febrile Spike (38.6°C)</span>
        </div>
        <p class="ai-text" style="color: #fca5a5;">
          CRITICAL: Sudden rate acceleration and oxygen saturation drop from 98% to 91%. Early Warning Score escalated to 8. Immediate bedside clinical examination recommended.
        </p>
        <div class="ai-recommendation" style="border-left-color: #ef4444;">
          <span class="rec-label" style="color: #ef4444;">Action Required:</span> Order stat 12-lead ECG, blood cultures, titrate supplemental O2 to maintain SpO2 ≥ 94%.
        </div>
      `;
    }
  } else {
    cardHR?.classList.remove('critical-alert');
    cardSpO2?.classList.remove('critical-alert');
    const hrStatus = document.getElementById('web-status-hr');
    if (hrStatus) {
      hrStatus.textContent = 'Normal Sinus';
      hrStatus.className = 'vital-status-pill normal';
    }
    const spo2Status = document.getElementById('web-status-spo2');
    if (spo2Status) {
      spo2Status.textContent = 'Optimal Saturation';
      spo2Status.className = 'vital-status-pill normal';
    }

    // Segment 5 AI Baseline
    if (news2Val) news2Val.innerHTML = `2 <small>/ 20</small>`;
    if (news2Pill) {
      news2Pill.textContent = 'Score: 2 (Low Risk)';
      news2Pill.className = 'vital-status-pill normal';
    }
    if (news2Bar) {
      news2Bar.style.width = '15%';
      news2Bar.className = 'model-fill green';
    }
    if (sepsisVal) sepsisVal.innerHTML = `0 <small>/ 3</small>`;
    if (sepsisPill) {
      sepsisPill.textContent = 'Negative (0/3)';
      sepsisPill.className = 'vital-status-pill normal';
    }
    if (sepsisBar) {
      sepsisBar.style.width = '0%';
      sepsisBar.className = 'model-fill green';
    }
    if (arrhythmiaPill) {
      arrhythmiaPill.textContent = 'Sinus Rhythm';
      arrhythmiaPill.className = 'vital-status-pill normal';
    }
    if (arrConf) arrConf.innerHTML = `99.2% <small>Confidence</small>`;
  }
}

// ===================================================================
// MOBILE APP NAVIGATION & TOUCH INTERACTIONS
// ===================================================================

function initMobileNavigation() {
  const navBtns = document.querySelectorAll('.mob-nav-btn');
  const tabContents = document.querySelectorAll('.mobile-tab-content');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTabId = btn.getAttribute('data-tab');
      navBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(t => t.classList.remove('active'));

      btn.classList.add('active');
      const targetTab = document.getElementById(targetTabId);
      if (targetTab) targetTab.classList.add('active');
    });
  });

  // Shortcut from Home Hygiene Ring to Hygiene Timer Tab
  const btnGotoTimer = document.getElementById('mob-btn-goto-timer');
  if (btnGotoTimer) {
    btnGotoTimer.addEventListener('click', () => {
      document.querySelector('.mob-nav-btn[data-tab="tab-mob-hygiene"]')?.click();
    });
  }

  // Quick Action Buttons on Mobile Home
  const btnQuickWash = document.getElementById('mob-quick-wash');
  if (btnQuickWash) {
    btnQuickWash.addEventListener('click', () => {
      state.vitals.hygieneScore = Math.min(100, state.vitals.hygieneScore + 1);
      updateVitalsUI();
      showToast('🧼 Hand Disinfection Logged (+1 Hygiene Score)');
    });
  }

  const btnQuickSync = document.getElementById('mob-quick-sync');
  if (btnQuickSync) {
    btnQuickSync.addEventListener('click', () => {
      showToast('📡 Sensors Synced via BLE: 4 packets received');
    });
  }

  const btnQuickDoc = document.getElementById('mob-quick-doctor');
  if (btnQuickDoc) {
    btnQuickDoc.addEventListener('click', () => {
      document.querySelector('.mob-nav-btn[data-tab="tab-mob-consult"]')?.click();
    });
  }

  const btnQuickMeds = document.getElementById('mob-quick-meds');
  if (btnQuickMeds) {
    btnQuickMeds.addEventListener('click', () => {
      showToast('💊 Morning Medication Logged: Metoprolol 25mg taken');
    });
  }
}

// ===================================================================
// WHO 20-SECOND INTERACTIVE HAND HYGIENE TIMER
// ===================================================================

function initWashTimer() {
  const digits = document.getElementById('wash-timer-digits');
  const badge = document.getElementById('wash-step-badge');
  const title = document.getElementById('wash-step-title');
  const desc = document.getElementById('wash-step-desc');
  const btnStart = document.getElementById('btn-start-wash-timer');
  const btnReset = document.getElementById('btn-reset-wash-timer');

  if (!btnStart || !btnReset) return;

  function updateStepGuidance(secondsLeft) {
    const elapsed = state.washTimer.totalDuration - secondsLeft;
    // Map elapsed 20s across 6 steps (~3.3s each)
    const stepIdx = Math.min(5, Math.floor(elapsed / 3.33));
    const currentStep = state.washTimer.steps[stepIdx];

    if (badge) badge.textContent = currentStep.num;
    if (title) title.textContent = currentStep.title;
    if (desc) desc.textContent = currentStep.desc;
  }

  btnStart.addEventListener('click', () => {
    if (state.washTimer.active) return;
    state.washTimer.active = true;
    btnStart.textContent = 'Washing...';
    btnStart.style.opacity = '0.7';

    state.washTimer.timerId = setInterval(() => {
      state.washTimer.remaining--;
      if (digits) digits.textContent = state.washTimer.remaining.toString().padStart(2, '0');
      updateStepGuidance(state.washTimer.remaining);

      if (state.washTimer.remaining <= 0) {
        clearInterval(state.washTimer.timerId);
        state.washTimer.active = false;
        btnStart.textContent = 'Completed! 🎉';
        btnStart.style.opacity = '1';
        state.vitals.hygieneScore = Math.min(100, state.vitals.hygieneScore + 2);
        updateVitalsUI();
        showToast('🌟 Certified 20-Second Hand Hygiene Completed! +2 Score');
      }
    }, 1000);
  });

  btnReset.addEventListener('click', () => {
    clearInterval(state.washTimer.timerId);
    state.washTimer.active = false;
    state.washTimer.remaining = 20;
    if (digits) digits.textContent = '20';
    if (btnStart) {
      btnStart.textContent = 'Start 20s Wash';
      btnStart.style.opacity = '1';
    }
    updateStepGuidance(20);
  });
}

// ===================================================================
// EMERGENCY SOS MODAL CONTROLLER
// ===================================================================

function initSOSModal() {
  const modal = document.getElementById('modal-sos');
  const btnGlobalSOS = document.getElementById('btn-global-sos');
  const btnMobSOS = document.getElementById('mob-btn-sos');
  const btnCancel = document.getElementById('btn-cancel-sos');
  const btnConfirm = document.getElementById('btn-confirm-sos');
  const countEl = document.getElementById('sos-countdown');

  let countdownSeconds = 10;
  let countdownInterval = null;

  function openSOS() {
    if (!modal) return;
    modal.classList.add('open');

    // Populate live snapshot
    const snapHR = document.getElementById('sos-snap-hr');
    const snapSpO2 = document.getElementById('sos-snap-spo2');
    const snapTime = document.getElementById('sos-snap-time');

    if (snapHR) snapHR.textContent = `${state.vitals.heartRate} BPM`;
    if (snapSpO2) snapSpO2.textContent = `${state.vitals.spo2}%`;
    if (snapTime) snapTime.textContent = new Date().toLocaleTimeString();

    // Start 10-second auto-dispatch countdown
    countdownSeconds = 10;
    if (countEl) countEl.textContent = '10';

    clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
      countdownSeconds--;
      if (countEl) countEl.textContent = countdownSeconds.toString();
      if (countdownSeconds <= 0) {
        clearInterval(countdownInterval);
        closeSOS();
        showToast('🚨 Critical SOS Emergency Dispatched to Hospital ER & Attending Cardiologist!');
      }
    }, 1000);
  }

  function closeSOS() {
    clearInterval(countdownInterval);
    modal?.classList.remove('open');
  }

  btnGlobalSOS?.addEventListener('click', openSOS);
  btnMobSOS?.addEventListener('click', openSOS);

  btnCancel?.addEventListener('click', () => {
    closeSOS();
    showToast('✅ SOS False Alarm Disarmed Successfully');
  });

  btnConfirm?.addEventListener('click', () => {
    closeSOS();
    showToast('🚨 SOS Emergency Immediately Dispatched to ER & Crash Team!');
  });
}

// ===================================================================
// DEDICATED APPLICATION SEGMENT CONTROLLERS (Segments 1 - 5)
// ===================================================================

function initHardwareControls() {
  initWebSegmentNavigation();
  initHygieneSegment();
  initIoTSegment();
  initEMRSegment();
  initAISegment();
  initTelehealthModals();
}

// Segment Routing Manager
function initWebSegmentNavigation() {
  const segmentMeta = {
    'telemetry': { title: 'Live Telemetry & Bedside Monitoring', crumb: 'TELEMETRY' },
    'hygiene': { title: 'Hygiene & Infection Control Center', crumb: 'HYGIENE CONTROL' },
    'devices': { title: 'Biomedical IoT Hub & Sensors Gateway', crumb: 'IOT HARDWARE' },
    'patients': { title: 'Patient EMR Queue & Ward Directory', crumb: 'EMR RECORDS' },
    'ai-triage': { title: 'AI Risk Triage & Diagnostic Intelligence', crumb: 'AI TRIAGE' }
  };

  const navBtns = document.querySelectorAll('.sidebar-nav .nav-item');
  const segments = document.querySelectorAll('.web-segment');
  const titleText = document.getElementById('segment-title-text');
  const crumbName = document.getElementById('segment-crumb-name');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const page = btn.getAttribute('data-page');
      
      // Toggle Segment Views
      segments.forEach(seg => {
        if (seg.getAttribute('data-segment') === page) {
          seg.classList.add('active');
        } else {
          seg.classList.remove('active');
        }
      });

      // Update Header Text & Breadcrumb
      if (segmentMeta[page]) {
        if (titleText) titleText.textContent = segmentMeta[page].title;
        if (crumbName) crumbName.textContent = segmentMeta[page].crumb;
      }

      // If returning to telemetry, re-render oscilloscope trace
      if (page === 'telemetry') {
        setTimeout(resizeECGCanvas, 60);
      }

      showToast(`Navigated to Segment: ${segmentMeta[page]?.crumb || page.toUpperCase()}`);
    });
  });
}

// Segment 2: Hygiene & Infection Controllers
function initHygieneSegment() {
  const btnRefillAll = document.getElementById('btn-refill-all');
  const btnUVC = document.getElementById('btn-trigger-uvc');

  if (btnRefillAll) {
    btnRefillAll.addEventListener('click', () => {
      for (let i = 1; i <= 4; i++) {
        const fill = document.getElementById(`st-fill-${i}`);
        const lvl = document.getElementById(`st-lvl-${i}`);
        if (fill) fill.style.width = '100%';
        if (lvl) lvl.textContent = '100% (1000 ml)';
      }
      const st3 = document.getElementById('st-status-3');
      if (st3) {
        st3.textContent = '● Online';
        st3.className = 'disp-status ok';
      }
      const kpiTotal = document.getElementById('kpi-disp-total');
      if (kpiTotal) kpiTotal.textContent = '740';
      showToast('🧼 All 4 Ward Dispensers Refilled to 100% (1000 ml)');
    });
  }

  document.querySelectorAll('.btn-refill-single').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-st');
      const fill = document.getElementById(`st-fill-${id}`);
      const lvl = document.getElementById(`st-lvl-${id}`);
      if (fill) fill.style.width = '100%';
      if (lvl) lvl.textContent = '100% (1000 ml)';
      if (id === '3') {
        const st3 = document.getElementById('st-status-3');
        if (st3) {
          st3.textContent = '● Online';
          st3.className = 'disp-status ok';
        }
      }
      showToast(`Station #${id} Sanitizer Fluid Refilled (1000 ml)`);
    });
  });

  if (btnUVC) {
    btnUVC.addEventListener('click', () => {
      showToast('⚡ Initiating Automated Autonomous UV-C Corridor Sterilization Cycle...');
      setTimeout(() => {
        showToast('Autonomous UV-C Robot Active: Ward 4 Corridor Sterilization in Progress');
      }, 1200);
    });
  }
}

// Segment 3: Biomedical IoT Terminal & Hardware
function initIoTSegment() {
  const terminal = document.getElementById('iot-terminal-body');
  let streamingPaused = false;

  // Append simulated packets periodically
  setInterval(() => {
    if (streamingPaused || !terminal) return;
    const now = new Date().toISOString().substring(11, 23);
    const tags = [
      { tag: 'ecg', name: '[ECG]', text: `LEAD_II: 0x${Math.floor(Math.random()*255).toString(16).toUpperCase()} | HR: ${state.vitals.heartRate} BPM | FILT: 50Hz NOTCH | CRC: OK` },
      { tag: 'spo2', name: '[SPO2]', text: `MAX30102: RATIO_R: 0.${Math.floor(Math.random()*20 + 75)} | SAT: ${state.vitals.spo2}% | PERF_IDX: 4.8%` },
      { tag: 'temp', name: '[TEMP]', text: `MLX90614: CORE: ${state.vitals.temp} C | DIE_TEMP: 22.4 C | ACCURACY: ±0.1 C` },
      { tag: 'disp', name: '[DISP]', text: `RFID_DOORWAY: WARD_4B | RSSI: -44dBm | COMPLIANCE: 100%` }
    ];
    const picked = tags[Math.floor(Math.random() * tags.length)];
    const line = document.createElement('div');
    line.className = 'term-line';
    line.innerHTML = `<span class="term-ts">[${now}]</span> <span class="term-tag ${picked.tag}">${picked.name}</span> ${picked.text}`;
    terminal.appendChild(line);
    if (terminal.childElementCount > 35) {
      terminal.firstElementChild?.remove();
    }
    terminal.scrollTop = terminal.scrollHeight;
  }, 2800);

  const btnPause = document.getElementById('btn-pause-stream');
  if (btnPause) {
    btnPause.addEventListener('click', () => {
      streamingPaused = !streamingPaused;
      btnPause.textContent = streamingPaused ? 'Resume Console' : 'Pause Console';
      showToast(streamingPaused ? 'IoT Telemetry Stream Paused' : 'IoT Telemetry Stream Resumed');
    });
  }

  const btnClear = document.getElementById('btn-clear-stream');
  if (btnClear && terminal) {
    btnClear.addEventListener('click', () => {
      terminal.innerHTML = '<div class="term-line"><span class="term-ts">[Console Cleared]</span> Awaiting new ESP32 packets...</div>';
      showToast('Terminal Log Cleared');
    });
  }

  const btnScan = document.getElementById('btn-iot-scan');
  if (btnScan) {
    btnScan.addEventListener('click', () => {
      showToast('📡 Scanning BLE 5.2 Mesh: 5 Medical Nodes Active (0% Packet Loss)');
    });
  }

  // Interactive Hardware Control Buttons
  document.querySelectorAll('.btn-iot-action').forEach(btn => {
    btn.addEventListener('click', () => {
      const hw = btn.getAttribute('data-hw');

      if (hw === 'bp') {
        btn.textContent = 'Inflating 150 mmHg...';
        btn.style.opacity = '0.7';
        showToast('Auto-cuff inflating to 150 mmHg...');

        setTimeout(() => {
          btn.textContent = 'Measuring MAP...';
          setTimeout(() => {
            btn.textContent = 'Start NIBP Cycle';
            btn.style.opacity = '1';
            state.vitals.bpSys = 120;
            state.vitals.bpDia = 80;
            updateVitalsUI();
            showToast('🩸 NIBP Cycle Complete: 120/80 mmHg (MAP: 93)');
          }, 1500);
        }, 1500);
        return;
      }

      const isActive = btn.classList.contains('active');
      if (isActive) {
        btn.classList.remove('active');
        btn.textContent = 'Standby / Connect';
        btn.style.background = 'rgba(255,255,255,0.06)';
        btn.style.color = 'var(--text-muted)';
        btn.closest('.iot-card')?.classList.remove('connected');
        showToast(`Hardware Sensor [${hw.toUpperCase()}] Placed in Standby`);
      } else {
        btn.classList.add('active');
        btn.textContent = 'Paired & Active';
        btn.style.background = 'rgba(16, 185, 129, 0.15)';
        btn.style.color = '#34d399';
        btn.closest('.iot-card')?.classList.add('connected');
        showToast(`Hardware Sensor [${hw.toUpperCase()}] Connected & Streaming`);
      }
    });
  });

  document.querySelectorAll('.btn-iot-calibrate').forEach(b => {
    b.addEventListener('click', () => {
      const hw = b.getAttribute('data-hw') || 'Sensor';
      showToast(`Calibrating [${hw.toUpperCase()}] baseline offset... Done (Offset: 0.00)`);
    });
  });
}

// Segment 4: Patient EMR Directory & Queue
function initEMRSegment() {
  const searchInput = document.getElementById('patient-search-input');
  const rows = document.querySelectorAll('.patient-row');
  const filterPills = document.querySelectorAll('.filter-pill');

  // Search by name / bed / ID
  searchInput?.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    rows.forEach(r => {
      r.style.display = r.textContent.toLowerCase().includes(val) ? '' : 'none';
    });
  });

  // Triage filter pills
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const filter = pill.getAttribute('data-filter');

      rows.forEach(r => {
        if (filter === 'all') {
          r.style.display = '';
        } else if (filter === 'critical') {
          r.style.display = r.innerHTML.includes('Critical') ? '' : 'none';
        } else if (filter === 'urgent') {
          r.style.display = r.innerHTML.includes('Monitored') ? '' : 'none';
        } else if (filter === 'stable') {
          r.style.display = (r.innerHTML.includes('Stable') || r.innerHTML.includes('Observing')) ? '' : 'none';
        }
      });
    });
  });

  // Comprehensive Patients Database
  const patientsDB = {
    'P-104': { 
      name: 'Marcus Reynolds', 
      age: 58, 
      gender: 'M',
      bed: 'Ward 4B - Bed 12', 
      diag: 'Post-Op Cardiovascular Monitoring • Hypertensive', 
      notes: 'Patient is recovering well post-coronary intervention. Continuous ECG Lead-II telemetry demonstrates normal sinus pattern. Hand hygiene logs verify 100% staff compliance.',
      hr: 74, 
      spo2: 98, 
      temp: 36.8, 
      bpSys: 120, 
      bpDia: 80, 
      isAnomaly: false 
    },
    'P-105': { 
      name: 'Sarah Jenkins', 
      age: 42, 
      gender: 'F',
      bed: 'Ward 4B - Bed 13', 
      diag: 'Post-C-Section Wound Care & Healing Protocol', 
      notes: 'Incision site dry and intact. Sterile dressing change logged with full hygiene compliance. Afebrile and alert.',
      hr: 78, 
      spo2: 99, 
      temp: 36.6, 
      bpSys: 118, 
      bpDia: 76, 
      isAnomaly: false 
    },
    'P-106': { 
      name: 'David Chen', 
      age: 67, 
      gender: 'M',
      bed: 'Ward 4B - Bed 14', 
      diag: 'Acute Respiratory Viral Infection • Isolation Unit', 
      notes: 'High-flow oxygen cannula active. Strict negative pressure barrier precautions in place. Elevated heart rate and fever spike detected.',
      hr: 104, 
      spo2: 93, 
      temp: 38.4, 
      bpSys: 138, 
      bpDia: 88, 
      isAnomaly: true 
    },
    'P-107': { 
      name: 'Anita Roy', 
      age: 34, 
      gender: 'F',
      bed: 'Ward 4B - Bed 15', 
      diag: 'Post-Trauma Sepsis Surveillance Protocol', 
      notes: 'qSOFA score monitored continuous Q15M. Temperature steady at 37.1 C. Prophylactic antibiotic regimen active.',
      hr: 82, 
      spo2: 97, 
      temp: 37.1, 
      bpSys: 124, 
      bpDia: 82, 
      isAnomaly: false 
    }
  };

  document.querySelectorAll('.btn-switch-patient, .patient-row').forEach(elem => {
    elem.addEventListener('click', () => {
      const pid = elem.getAttribute('data-pid');
      if (!pid || !patientsDB[pid]) return;

      rows.forEach(r => r.classList.remove('selected'));
      document.querySelector(`.patient-row[data-pid="${pid}"]`)?.classList.add('selected');

      const data = patientsDB[pid];

      // Update EMR Drawer
      const nameEl = document.getElementById('emr-patient-fullname');
      const diagEl = document.getElementById('emr-patient-diagnosis');
      const notesEl = document.getElementById('emr-doctor-notes');
      const pidBadge = document.getElementById('emr-selected-pid');

      if (nameEl) nameEl.textContent = `${data.name} (${data.age} ${data.gender})`;
      if (diagEl) diagEl.textContent = `Bed: ${data.bed} • Diagnosis: ${data.diag}`;
      if (notesEl) notesEl.value = data.notes;
      if (pidBadge) pidBadge.textContent = `PATIENT #${pid}`;

      // Update Segment 1 Patient Header
      const livePName = document.querySelector('.patient-monitor-header .p-name');
      const livePCond = document.querySelector('.patient-monitor-header .p-conditions');
      const liveAvatar = document.querySelector('.patient-monitor-header .patient-avatar');

      if (livePName) livePName.innerHTML = `${data.name} (Age: ${data.age}) <span class="badge-status ${data.isAnomaly ? 'danger' : 'normal'}">${data.bed}</span>`;
      if (livePCond) livePCond.textContent = `Conditions: ${data.diag}`;
      if (liveAvatar) liveAvatar.textContent = pid;

      // Update Global State Vitals to selected patient
      state.vitals.heartRate = data.hr;
      state.vitals.spo2 = data.spo2;
      state.vitals.temp = data.temp;
      state.vitals.bpSys = data.bpSys;
      state.vitals.bpDia = data.bpDia;
      state.vitals.isAnomaly = data.isAnomaly;

      updateVitalsUI();
      showToast(`Switched Active Monitoring Feed to #${pid} (${data.name})`);
    });
  });

  const btnSaveNotes = document.getElementById('btn-save-emr-notes');
  if (btnSaveNotes) {
    btnSaveNotes.addEventListener('click', () => {
      showToast('💾 Physician Clinical Notes Encrypted & Saved to EMR Database');
    });
  }
}

// Segment 5: AI Diagnostic Risk Triage
function initAISegment() {
  const btnRun = document.getElementById('btn-run-neural-triage');
  const chkFever = document.getElementById('chk-sym-fever');
  const chkTachy = document.getElementById('chk-sym-tachy');
  const chkDyspnea = document.getElementById('chk-sym-dyspnea');
  const chkHypo = document.getElementById('chk-sym-hypotension');
  const chkWound = document.getElementById('chk-sym-wound');
  const chkHygiene = document.getElementById('chk-sym-hygiene-lapse');

  function calculateInteractiveNEWS2() {
    let score = 2; // baseline
    if (chkFever?.checked) score += 3;
    if (chkTachy?.checked) score += 2;
    if (chkDyspnea?.checked) score += 3;
    if (chkHypo?.checked) score += 2;
    if (chkWound?.checked) score += 2;
    if (chkHygiene?.checked) score += 1;

    const news2Val = document.getElementById('news2-score-val');
    const news2Pill = document.getElementById('news2-pill');
    const news2Bar = document.getElementById('news2-bar');
    const sepsisVal = document.getElementById('sepsis-score-val');
    const sepsisPill = document.getElementById('sepsis-pill');
    const sepsisBar = document.getElementById('sepsis-bar');

    if (news2Val) news2Val.innerHTML = `${score} <small>/ 20</small>`;

    if (score >= 7) {
      if (news2Pill) {
        news2Pill.textContent = `Score: ${score} (Critical Alert)`;
        news2Pill.className = 'vital-status-pill danger';
      }
      if (news2Bar) {
        news2Bar.style.width = `${Math.min(100, score * 10)}%`;
        news2Bar.className = 'model-fill red';
      }
      if (sepsisVal) sepsisVal.innerHTML = `2 <small>/ 3</small>`;
      if (sepsisPill) {
        sepsisPill.textContent = 'Positive qSOFA (2/3)';
        sepsisPill.className = 'vital-status-pill danger';
      }
      if (sepsisBar) {
        sepsisBar.style.width = '66%';
        sepsisBar.className = 'model-fill red';
      }
    } else if (score >= 5) {
      if (news2Pill) {
        news2Pill.textContent = `Score: ${score} (Medium Alert)`;
        news2Pill.className = 'vital-status-pill danger';
      }
      if (news2Bar) {
        news2Bar.style.width = '50%';
        news2Bar.className = 'model-fill red';
      }
      if (sepsisVal) sepsisVal.innerHTML = `1 <small>/ 3</small>`;
      if (sepsisPill) {
        sepsisPill.textContent = 'Surveillance (1/3)';
        sepsisPill.className = 'vital-status-pill normal';
      }
      if (sepsisBar) {
        sepsisBar.style.width = '33%';
        sepsisBar.className = 'model-fill green';
      }
    } else {
      if (news2Pill) {
        news2Pill.textContent = `Score: ${score} (Low Risk)`;
        news2Pill.className = 'vital-status-pill normal';
      }
      if (news2Bar) {
        news2Bar.style.width = '20%';
        news2Bar.className = 'model-fill green';
      }
      if (sepsisVal) sepsisVal.innerHTML = `0 <small>/ 3</small>`;
      if (sepsisPill) {
        sepsisPill.textContent = 'Negative (0/3)';
        sepsisPill.className = 'vital-status-pill normal';
      }
      if (sepsisBar) {
        sepsisBar.style.width = '0%';
        sepsisBar.className = 'model-fill green';
      }
    }
  }

  [chkFever, chkTachy, chkDyspnea, chkHypo, chkWound, chkHygiene].forEach(chk => {
    chk?.addEventListener('change', calculateInteractiveNEWS2);
  });

  if (btnRun) {
    btnRun.addEventListener('click', () => {
      showToast('🤖 Running Multi-Head Neural Diagnostic Inference...');
      calculateInteractiveNEWS2();

      const narrative = document.getElementById('ai-narrative-text');
      const rec = document.getElementById('ai-rec-box');

      setTimeout(() => {
        if (chkFever?.checked || chkTachy?.checked || chkWound?.checked) {
          if (narrative) narrative.textContent = 'NEURAL ANALYSIS: Multimodal telemetry inputs detect elevated inflammatory biomarkers combined with rate instability. High probability of systemic bacteremia or post-operative surgical site contamination.';
          if (rec) rec.innerHTML = '<span class="rec-label" style="color: #ef4444;">Stat Intervention:</span> Draw blood cultures x2, initiate empiric broad-spectrum antibiotic protocol, continuous SpO2 & ECG Lead-II telemetry.';
        } else {
          if (narrative) narrative.textContent = 'NEURAL ANALYSIS: Continuous Lead-II analysis indicates standard sinus rhythm (Mean: 74 BPM). Pulse Oximetry reflects consistent alveolar perfusion at 98%. Hand sanitation logs recorded 7 cycles in the past 6 hours, maintaining low bacterial cross-transmission probability.';
          if (rec) rec.innerHTML = '<span class="rec-label">Clinical Decision Support:</span> Patient qualifies for standard post-operative pathway. Continue continuous telemetry and scheduled surface disinfection checks.';
        }
        showToast('✅ Neural Inference Complete (Confidence: 99.1%)');
      }, 700);
    });
  }

  // Device pairing toggles in mobile simulator
  document.querySelectorAll('.btn-dev-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const isConnected = btn.classList.contains('active');
      if (isConnected) {
        btn.classList.remove('active');
        btn.textContent = 'Connect';
        btn.closest('.device-item-card')?.classList.remove('connected');
        showToast('Sensor Disconnected');
      } else {
        btn.classList.add('active');
        btn.textContent = 'Paired';
        btn.closest('.device-item-card')?.classList.add('connected');
        showToast('Medical BLE Sensor Paired Successfully');
      }
    });
  });

  // Scan BLE button
  const btnScanMob = document.getElementById('btn-scan-ble');
  if (btnScanMob) {
    btnScanMob.addEventListener('click', () => {
      showToast('Scanning BLE 2.4GHz frequencies... 4 beacons active');
    });
  }

  // Export PDF button
  const btnPDF = document.getElementById('btn-export-pdf');
  if (btnPDF) {
    btnPDF.addEventListener('click', () => {
      showToast('📄 Generating Clinical Telemetry Report PDF...');
      setTimeout(() => {
        window.print();
      }, 600);
    });
  }
}

// ===================================================================
// TELEHEALTH VIDEO CONSULT & CLINICAL CHAT MODALS
// ===================================================================

function initTelehealthModals() {
  // Video Consult Modal
  const modalVideo = document.getElementById('modal-video-call');
  const btnStartCall = document.getElementById('btn-mob-telecall');
  const btnCloseCall = document.getElementById('btn-close-call');
  const btnEndCall = document.getElementById('btn-call-end');
  const btnMute = document.getElementById('btn-call-mute');
  const btnCam = document.getElementById('btn-call-cam');
  const timerEl = document.getElementById('call-timer');

  let callSeconds = 0;
  let callTimerInterval = null;
  let isMuted = false;
  let isCamOff = false;

  function openVideoCall() {
    if (!modalVideo) return;
    modalVideo.classList.add('open');
    callSeconds = 0;
    if (timerEl) timerEl.textContent = '00:00';

    clearInterval(callTimerInterval);
    callTimerInterval = setInterval(() => {
      callSeconds++;
      const mins = Math.floor(callSeconds / 60).toString().padStart(2, '0');
      const secs = (callSeconds % 60).toString().padStart(2, '0');
      if (timerEl) timerEl.textContent = `${mins}:${secs}`;
    }, 1000);

    showToast('📹 Connected with Dr. Elena Vance (Encrypted WebRTC Stream)');
  }

  function closeVideoCall() {
    clearInterval(callTimerInterval);
    modalVideo?.classList.remove('open');
    showToast(`Video Consult Ended (Duration: ${callSeconds}s)`);
  }

  btnStartCall?.addEventListener('click', openVideoCall);
  btnCloseCall?.addEventListener('click', closeVideoCall);
  btnEndCall?.addEventListener('click', closeVideoCall);

  btnMute?.addEventListener('click', () => {
    isMuted = !isMuted;
    btnMute.textContent = isMuted ? '🔇 Mic Muted' : '🎤 Mute Mic';
    btnMute.classList.toggle('active-toggled', isMuted);
    showToast(isMuted ? 'Microphone Muted' : 'Microphone Unmuted');
  });

  btnCam?.addEventListener('click', () => {
    isCamOff = !isCamOff;
    btnCam.textContent = isCamOff ? '📹 Camera On' : '📷 Camera Off';
    btnCam.classList.toggle('active-toggled', isCamOff);
    showToast(isCamOff ? 'Camera Disabled' : 'Camera Enabled');
  });

  // Clinical Team Chat Modal
  const modalChat = document.getElementById('modal-chat');
  const btnOpenChat = document.getElementById('btn-mob-chat');
  const btnQuickChat = document.getElementById('mob-quick-doctor');
  const btnCloseChat = document.getElementById('btn-close-chat');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input-text');
  const messagesContainer = document.getElementById('chat-messages-container');

  function openChat() {
    modalChat?.classList.add('open');
    setTimeout(() => {
      if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 100);
  }

  function closeChat() {
    modalChat?.classList.remove('open');
  }

  btnOpenChat?.addEventListener('click', openChat);
  btnQuickChat?.addEventListener('click', openChat);
  btnCloseChat?.addEventListener('click', closeChat);

  function appendChatMessage(sender, text, isDoctor = false) {
    if (!messagesContainer) return;
    const msg = document.createElement('div');
    msg.className = `chat-msg ${isDoctor ? 'doc' : 'patient'}`;
    msg.innerHTML = `<strong>${sender}:</strong> ${text}`;
    messagesContainer.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  chatForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput?.value?.trim();
    if (!text) return;

    appendChatMessage('You', text, false);
    chatInput.value = '';

    // Automated Doctor/Clinical Reply
    setTimeout(() => {
      const replies = [
        "Received. Your Lead-II telemetry continues to display a steady normal sinus waveform.",
        "Understood. The nursing team has been alerted to review your sterile dressing at the next check.",
        "Thank you Marcus. Please maintain your hand hygiene routines and monitor for any sudden palpitations."
      ];
      const randomReply = replies[Math.floor(Math.random() * replies.length)];
      appendChatMessage('Dr. Elena Vance', randomReply, true);
    }, 1100);
  });

  // Quick Suggestion Chips
  document.querySelectorAll('.chat-chip-btn').forEach(chip => {
    chip.addEventListener('click', () => {
      const msg = chip.getAttribute('data-msg');
      if (msg && chatInput) {
        chatInput.value = msg;
        chatForm?.dispatchEvent(new Event('submit'));
      }
    });
  });

  // Mobile Hygiene Task Checkbox Interactivity
  const taskCheckboxes = document.querySelectorAll('.daily-hygiene-checklist input[type="checkbox"]');
  taskCheckboxes.forEach(chk => {
    chk.addEventListener('change', () => {
      const total = taskCheckboxes.length;
      let checkedCount = 0;
      taskCheckboxes.forEach(c => { if (c.checked) checkedCount++; });

      const pct = Math.round((checkedCount / total) * 100);
      const ringText = document.querySelector('.ring-center-text');
      const ringCircle = document.querySelector('.circle-val');

      if (ringText) ringText.textContent = `${pct}%`;
      if (ringCircle) ringCircle.setAttribute('stroke-dasharray', `${pct}, 100`);

      showToast(`Daily Hygiene Progress: ${checkedCount}/${total} Completed (${pct}%)`);
    });
  });
}


// ===================================================================
// SYSTEM UTILITIES (Clock & Toasts)
// ===================================================================

function startClock() {
  const clockEl = document.getElementById('mobile-clock');
  function updateTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const mins = now.getMinutes().toString().padStart(2, '0');
    if (clockEl) clockEl.textContent = `${hours}:${mins}`;
  }
  setInterval(updateTime, 1000);
  updateTime();
}

function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#06b6d4" stroke-width="2">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}
