import React from 'react'

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
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="bg-slate-900/70 border border-rose-500/30 rounded-xl p-6 max-w-md text-center">
            <span className="text-3xl block mb-2">⚠️</span>
            <h1 className="text-base font-bold mb-2">Terjadi kesalahan aplikasi</h1>
            <p className="text-xs text-slate-400 mb-4">{this.state.message}</p>
            <button
              onClick={() => { this.setState({ hasError: false, message: null }); window.location.reload() }}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm border border-slate-700"
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
