import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// StrictMode temporarily removed due to TipTap + React 18 compatibility issues
// In production, StrictMode causes double-render which breaks TipTap editor focus
createRoot(document.getElementById('root')!).render(
    <App />
)
