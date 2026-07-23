import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Portal rendering failure:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="card max-w-lg text-center">
          <h1 className="text-xl font-bold text-red-700">
            This page could not be displayed
          </h1>
          <p className="text-sm text-gray-600 mt-3">
            Your saved portal data has not been affected.
          </p>
          <p className="text-xs text-gray-400 mt-2 break-words">
            {this.state.error.message}
          </p>
          <button
            type="button"
            className="btn-primary mt-5"
            onClick={() => window.location.reload()}
          >
            Reload Portal
          </button>
        </div>
      </div>
    )
  }
}
