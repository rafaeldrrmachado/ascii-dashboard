# ASCII Terminal Dashboard ⚡

A lightweight, retro cyber-terminal dashboard featuring an animated ASCII plasma background, CRT scanlines, personal system profile HUD, and a real-time **Portugal Electricity (MIBEL / OMIE) Market Monitor**.

Designed for ambient desktop monitors, home server displays, and repurposed mobile devices / old phones running as dedicated desk clocks.

---

## ✨ Features

- **Procedural ASCII Plasma Background**: Mathematical sinusoidal wave interference mapped onto customizable ASCII character sets (` .:-=+*#%@`).
- **Portugal Electricity Market Monitor (MIBEL / OMIE)**:
  - **Live Spot Price**: Displays real-time wholesale pool rates in `€/MWh` and `c€/kWh` with classification badges (`CHEAP`, `NORMAL`, `HIGH`, `PEAK`).
  - **Today's Intraday Spread**: Tracks today's minimum, average, and peak prices.
  - **Historical Evolution**: Interactive cycle between **7-Day (Week)** and **30-Day (Month)** evolution with scalable vector line charts, glowing area gradients, and interactive HUD telemetry.
  - **Price Prediction**: Interactive cycle between **Tomorrow (Day-Ahead)** 24h auction curve and **7-Day Outlook** with shaded optimal solar window detection and weekend dip forecasting.
  - **Resilient Data Architecture**: Directly connects to the official REE/OMIE open data API (`apidatos.ree.es`) with automated fallback to a calibrated Iberian solar duck curve model when offline.
- **Low-Power / Battery Optimization**: Built-in frame rate governor (~20 FPS) to drastically reduce CPU, thermal, and battery consumption on mobile and ambient hardware.
- **Ambient Auto-Cycle Mode**: Optional auto-toggle that alternates between the System Profile and the Energy Dashboard every 25 seconds—ideal for hands-free ambient phone displays.
- **Dynamic Monospace Measurement**: Automatically calculates character glyph metrics via HTML5 Canvas to eliminate edge clipping on any display resolution or pixel ratio.
- **Zero Dependencies**: Pure HTML5, CSS3, and Vanilla JavaScript with no build steps or node dependencies required.
- **Accessibility Aware**: Fully respects `prefers-reduced-motion` settings.

---

## 📁 Repository Structure

```text
ascii-dashboard/
├── index.html            # Main semantic HTML entry point with tabbed HUD
├── css/
│   └── style.css         # Styling, CRT scanlines, HUD badges & responsive layout
├── js/
│   ├── plasma.js         # Procedural ASCII plasma canvas animation engine
│   ├── i18n.js           # Dual-language (EN / PT) engine & persistent preference
│   ├── energy.js         # MIBEL/OMIE API client, vector SVG line graph generator & telemetry
│   └── app.js            # Dashboard coordinator, tab routing, clock & hotkeys
├── data/
│   └── omie_pt.json      # Official OMIE Portuguese spot price dataset (auto-synced)
├── sync_omie_pt.py       # OMIE Portugal parser & synchronizer
├── server.py             # Local auto-syncing HTTP server
├── .gitignore            # Git exclusion rules for OS and IDE files
└── README.md             # Project documentation
```

---

## 🚀 Getting Started

### Method 1: Direct File Launch
Double-click `index.html` or open it directly in any modern web browser:
```text
file:///path/to/ascii-dashboard/index.html
```

### Method 2: Local Auto-Sync Server (Recommended)
Run the built-in auto-syncing server:
```bash
python server.py
```
This automatically:
- Checks and syncs official Portuguese OMIE prices (`PRICE_PT`) **on startup and whenever you enter the website**.
- Serves the dashboard on `http://localhost:8000` and displays your local network IP (e.g., `http://192.168.1.X:8000`) for old phone ambient displays.
- Keeps data fresh in the background on an hourly schedule.

### Method 3: GitHub Pages (100% Automated via GitHub Actions)
A preconfigured workflow in `.github/workflows/sync-omie.yml` runs daily at 13:45 UTC (right after OMIE clears the day-ahead auction), commits the fresh `data/omie_pt.json` to `main`, and deploys it automatically to GitHub Pages.

---

## ⌨️ Controls & Navigation

| Control | Action |
|---|---|
| `[ 1: PROFILE ]` / `[ 2: ENERGY ]` | Switch between System Profile and Energy Grid |
| `[LANG: EN / PT]` | Swap dashboard language between English and Portuguese |
| `[AUTO: OFF / ON]` | Toggle 25-second ambient auto-cycle mode |
| `[ ◄ 24H | 7-DAY | 30-DAY ► ]` | Cycle historical evolution window (Last 24h, 7-day, 30-day) |
| `[ ◄ TOMORROW | 7-DAY ► ]` | Cycle prediction between Day-Ahead and 7-day outlook |
| `[REFRESH ↻]` | Fetch latest live spot market auction prices |

### Keyboard Shortcuts
- `1` or `P` : Switch to Profile view
- `2` or `E` : Switch to Energy view
- `Tab` : Toggle between views
- `L` : Toggle Language (`EN` ⇄ `PT`)
- `W` or `M` : Cycle Evolution (24h / 7d / 30d)
- `D` or `F` : Cycle Prediction (Day-Ahead / Forecast Week)
- `R` : Refresh live market data
- `A` : Toggle Ambient Auto-Cycle mode

---

## ⚙️ Customization

### 1. Theming & Colors
Theme colors can be adjusted directly in [`css/style.css`](css/style.css) under `:root`:

```css
:root {
  --background: #020508;
  --plasma: #00aaff;
  --border: #ffaf00;
  --text: #f5f5f5;
  --muted: #9ca3af;
  --card-background: rgba(3, 7, 12, 0.94);

  /* Energy status levels */
  --cheap: #00ffaa;
  --normal: #00aaff;
  --high: #ffaf00;
  --peak: #ff4444;
}
```

### 2. Plasma Configuration
Parameters can be tuned when instantiating `AsciiPlasma` in [`js/app.js`](js/app.js):

| Option | Default | Description |
|---|---|---|
| `targetFps` | `20` | Maximum FPS cap. Lower values save battery on old phones. |
| `characters` | `" .:-=+*#%@"` | Density ramp from darkest to brightest ASCII glyph. |
| `characterHeight`| `14` | Glyph font size in pixels. |
| `color` | `"#00aaff"` | Foreground text color of the plasma. |
| `timeSpeed` | `0.0018` | Animation speed multiplier. |

---

## 🌐 Deploying to GitHub Pages

1. Push this repository to GitHub.
2. In the repository settings, navigate to **Settings** > **Pages**.
3. Under **Build and deployment**, select **Source: Deploy from a branch** and choose `main` / `root`.
4. Your dashboard will be live at `https://<username>.github.io/ascii-dashboard/`.
