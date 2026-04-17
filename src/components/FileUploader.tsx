import React, { useRef, useState } from 'react'

interface Props {
  label: string
  accept?: string
  onFile: (file: File) => void
  loaded: boolean
  fileName?: string
}

export default function FileUploader({ label, accept = '.csv', onFile, loaded, fileName }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = (file: File) => {
    const maxBytes = 500 * 1024 * 1024 // 500 MB
    if (file.size > maxBytes) {
      alert(`Archivo muy grande (máx 500MB): ${(file.size / 1024 / 1024).toFixed(1)}MB`)
      return
    }
    onFile(file)
  }

  return (
    <div
      className={`relative border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all
        ${dragging ? 'border-indigo-400 bg-indigo-950/30' : loaded ? 'border-emerald-500 bg-emerald-950/20' : 'border-gray-700 bg-gray-900 hover:border-gray-500'}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) handleFile(file)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
      <div className="flex items-center gap-3">
        <div className={`text-2xl ${loaded ? 'text-emerald-400' : 'text-gray-500'}`}>
          {loaded ? '✓' : '↑'}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-300">{label}</p>
          {loaded && fileName
            ? <p className="text-xs text-emerald-400 mt-0.5 truncate max-w-xs">{fileName}</p>
            : <p className="text-xs text-gray-500 mt-0.5">Arrastrar aquí o clic para seleccionar</p>
          }
        </div>
      </div>
    </div>
  )
}
