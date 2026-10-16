import React from 'react'

/** Palet tema (bukan slate/rose) + teks ≥ 12 px & kontras AA — paket P1 fase design/UX. */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message ?? String(error) }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-soil text-mist flex items-center justify-center p-6">
          <div role="alert" className="bg-soil-raised border border-cherry-soft/40 rounded-card p-6 max-w-md text-center">
            <span aria-hidden="true" className="text-3xl block mb-2">⚠️</span>
            <h1 className="text-base font-bold mb-2">Terjadi kesalahan aplikasi</h1>
            <p className="text-sm text-mist-body mb-4">{this.state.message}</p>
            <button
              type="button"
              onClick={() => { this.setState({ hasError: false, message: null }); window.location.reload() }}
              className="min-h-11 px-4 rounded-lg bg-cherry text-on-accent text-sm font-semibold hover:bg-cherry-deep active:scale-[.97] transition"
            >
              Muat Ulang
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
