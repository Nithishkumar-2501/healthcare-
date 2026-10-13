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
  // Web Dashboard elements
  const webHR = document.getElementById('web-val-hr');
  const webSpO2 = document.getElementById('web-val-spo2');
  const webTemp = document.getElementById('web-val-temp');
  const webBP = document.getElementById('web-val-bp');
  const webHygiene = document.getElementById('web-val-hygiene');
  const webRisk = document.getElementById('web-val-risk');
  const ecgBpm = document.getElementById('ecg-live-bpm');
  const cardHR = document.getElementById('card-heart-rate');
  const cardSpO2 = document.getElementById('card-spo2');
  const aiBox = document.getElementById('ai-insight-box');

  // Mobile App elements
  const mobHR = document.getElementById('mob-val-hr');
  const mobSpO2 = document.getElementById('mob-val-spo2');
  const mobTemp = document.getElementById('mob-val-temp');
  const mobBP = document.getElementById('mob-val-bp');

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

  // Anomaly Visuals
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
    if (aiBox) {
      aiBox.innerHTML = `
        <div class="ai-badge-row">
          <span class="ai-badge danger" style="background: rgba(239, 68, 68, 0.2); color: #f87171;">Tachycardia Detected (138 BPM)</span>
          <span class="ai-badge danger" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24;">Febrile Temp (38.6°C)</span>
        </div>
        <p class="ai-text" style="color: #fca5a5;">
          CRITICAL: Sudden rate acceleration and oxygen saturation drop from 98% to 91%. Risk of septic response or post-operative arrhythmia. Immediate bedside clinical examination recommended.
        </p>
        <div class="ai-recommendation" style="border-left-color: #ef4444;">
          <span class="rec-label" style="color: #ef4444;">Action Required:</span> Administer IV fluids, verify ECG Lead contacts, alert on-duty cardiologist.
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
  }

  function closeSOS() {
    modal?.classList.remove('open');
  }

  btnGlobalSOS?.addEventListener('click', openSOS);
  btnMobSOS?.addEventListener('click', openSOS);
  btnCancel?.addEventListener('click', () => {
    closeSOS();
    showToast('SOS False Alarm Disarmed');
  });

  btnConfirm?.addEventListener('click', () => {
    closeSOS();
    showToast('🚨 SOS Dispatched to ER & Attending Cardiologist!');
  });
}

// ===================================================================
// HARDWARE SENSORS & GENERAL CONTROLS
// ===================================================================

function initHardwareControls() {
  // Web Sidebar Navigation click handlers
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-nav .nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const page = btn.getAttribute('data-page');

      if (page === 'telemetry') {
        document.querySelector('.vital-cards-grid')?.scrollIntoView({ behavior: 'smooth' });
      } else if (page === 'hygiene') {
        document.querySelector('.hygiene-matrix')?.scrollIntoView({ behavior: 'smooth' });
      } else if (page === 'devices') {
        document.querySelector('.ecg-oscilloscope-container')?.scrollIntoView({ behavior: 'smooth' });
      } else if (page === 'ai-triage') {
        document.querySelector('.ai-assistant')?.scrollIntoView({ behavior: 'smooth' });
      } else if (page === 'patients') {
        document.querySelector('.patient-monitor-header')?.scrollIntoView({ behavior: 'smooth' });
        showToast('Viewing Patient Record #P-104: Marcus Reynolds');
      }
    });
  });

  // Device pairing toggles
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
  const btnScan = document.getElementById('btn-scan-ble');
  if (btnScan) {
    btnScan.addEventListener('click', () => {
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

  // Re-run AI check button
  const btnAI = document.getElementById('btn-run-ai-check');
  if (btnAI) {
    btnAI.addEventListener('click', () => {
      showToast('🤖 AI Model Re-evaluating Biometrics & Infection Probability...');
      setTimeout(() => {
        showToast('Analysis Complete: Current parameters aligned with standard baseline');
      }, 1000);
    });
  }

  // Telehealth call buttons
  const btnTelecall = document.getElementById('btn-mob-telecall');
  if (btnTelecall) {
    btnTelecall.addEventListener('click', () => {
      showToast('📹 Initiating WebRTC Encrypted Video Consult with Dr. Elena Vance...');
    });
  }

  const btnChat = document.getElementById('btn-mob-chat');
  if (btnChat) {
    btnChat.addEventListener('click', () => {
      showToast('💬 Opening Secure Hospital Chat Channel...');
    });
  }
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
