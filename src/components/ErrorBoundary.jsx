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
        <div className="min-h-screen bg-surface text-ink flex items-center justify-center p-6 dark:bg-soil dark:text-mist">
          <div role="alert" className="bg-surface-raised dark:bg-soil-raised border border-cherry-soft/40 rounded-card p-6 max-w-md text-center">
            <h1 className="text-body font-bold mb-2">Maaf, bagian ini belum dapat ditampilkan.</h1>
            <p className="text-body text-ink-body dark:text-mist-body mb-4">Muat ulang halaman. Jika gangguan berlanjut, coba lagi beberapa saat lagi.</p>
            {this.state.message && (
              <details className="mb-4 text-caption text-left">
                <summary className="min-h-11 inline-flex cursor-pointer items-center underline underline-offset-2">Rincian teknis</summary>
                <p className="mt-1 break-words text-ink-muted dark:text-mist-muted">{this.state.message}</p>
              </details>
            )}
            <button
              type="button"
              onClick={() => { this.setState({ hasError: false, message: null }); window.location.reload() }}
              className="min-h-11 px-4 rounded-lg bg-cherry text-on-accent text-body font-semibold hover:bg-cherry-deep active:scale-[.97] transition"
            >
              Muat ulang halaman
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
