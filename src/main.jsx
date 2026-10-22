import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './styles/theme-directions.css'
import './styles/desktop-layout.css'

/**
 * Jaring pengaman: bila satu komponen melempar galat saat render, tampilkan
 * pesan yang bisa dibaca alih-alih layar kosong tanpa petunjuk.
 */
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[niu] render gagal', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" style={{ maxWidth: '44rem', margin: '3rem auto', padding: '1.25rem', border: '1px solid #DCCDB6', borderRadius: '18px', background: '#FBF6EC', color: '#241E17', fontFamily: 'system-ui, sans-serif', lineHeight: 1.55 }}>
        <h1 style={{ margin: '0 0 .5rem', fontSize: '1.125rem' }}>Aplikasi gagal dimuat</h1>
        <p style={{ margin: '0 0 .75rem', fontSize: '.875rem' }}>Terjadi galat saat menampilkan halaman. Data dan setelan Anda tidak berubah.</p>
        <p style={{ margin: '0 0 1rem', fontSize: '.75rem', wordBreak: 'break-word', opacity: .8 }}>{String(this.state.error?.message || this.state.error)}</p>
        <button type="button" className="min-h-11" onClick={() => window.location.reload()} style={{ padding: '0 1rem', border: 0, borderRadius: 10, background: '#2F4A38', color: '#fff', fontSize: '.875rem', fontWeight: 600, cursor: 'pointer' }}>
          Muat ulang
        </button>
      </div>
    )
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
)
