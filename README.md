# BioHygiene OS: Smart Healthcare, Hygiene & Biomedical Technology Platform

A comprehensive dual-platform solution combining **clinical telemetry**, **preventive hygiene compliance**, and **biomedical IoT sensing** for patient care and hospital ward management.

---

## 🌟 Local Development Server

The application is currently running live on localhost:

- **Localhost URL:** [http://localhost:5173/](http://localhost:5173/)
- **Network URL:** `http://10.2.0.2:5173/` (accessible on devices within your local network)

---

## 🖥️ Platform Modes

1. **Dual Real-Time Sync (Default):**
   - Shows the **Clinician Web Portal** on the left and the **Patient Smartphone App** on the right side-by-side.
   - Any vital fluctuation or emergency triggered on mobile is instantly reflected on the hospital workstation in real-time.

2. **Web Clinician Portal:**
   - Full desktop medical workstation for doctors and nurses.
   - Real-time **ECG Lead II Oscilloscope** canvas with sweep trace (25 mm/s, 250 Hz sampling).
   - Multi-vital monitoring: Heart Rate, SpO2, Core Body Temperature, Blood Pressure (NIBP), Hygiene Compliance Score, and Nosocomial Infection Risk.
   - IoT Sanitization & Smart Dispenser Grid for ward surveillance.
   - AI Clinical Risk Assessment engine.

3. **Mobile Patient App Simulator:**
   - Interactive smartphone simulator with Dynamic Island, status bar, and tactile bottom navigation.
   - **Tabs:**
     - **Vitals:** Real-time personal health stats, quick habit logger, and emergency dispatch.
     - **Hygiene:** WHO-certified 20-second handwashing circular timer with step-by-step visual guidance.
     - **Sensors:** Medical BLE beacon scanner and pairing manager (ECG patch, Pulse oximeter, Thermometer, Dispenser).
     - **Doctor:** Telemedicine consultation portal, prescription viewer, and secure chat.

---

## 🔘 Key Interactive Controls & Buttons

| Button / Control | Location | Functionality |
| :--- | :--- | :--- |
| **Simulate Tachycardia Spike** | Web Header | Simulates abnormal heart rate acceleration (138 BPM), hypoxia dip (91%), and triggers AI clinical warning |
| **Reset Normal Vitals** | Web Header | Restores patient telemetry to normal baseline |
| **Export Clinical PDF** | Web Header | Formats telemetry summary into printable clinical report |
| **Freeze Trace** | ECG Oscilloscope | Pauses/resumes real-time sweep trace for waveform inspection |
| **Start 20s Wash** | Mobile Hygiene Tab | Initiates WHO 20-second step-by-step handwash countdown timer |
| **EMERGENCY SOS** | Top Bar & Mobile App | Opens critical alert modal with vital snapshot and ER dispatch timer |
| **Device Pairing Toggles** | Mobile Sensors Tab | Simulates BLE connection/disconnection with medical hardware |

---

## 🛠️ Technology Stack

- **Frontend:** Modern Semantic HTML5, Vanilla CSS3 (Custom Design System, Glassmorphism, Dark Mode)
- **Engine:** Vanilla JavaScript (ES Modules, HTML5 Canvas ECG Oscilloscope)
- **Dev Server:** Vite v6.4.4
- **Hardware Integration Simulation:** Simulated BLE 2.4 GHz packet streams and ESP32 gateway telemetry
