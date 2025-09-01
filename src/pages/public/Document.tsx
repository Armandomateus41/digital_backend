import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Label from '../../components/ui/Label'
import { Card, CardContent } from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import Empty from '../../components/ui/Empty'
import Toast from '../../components/Toast'
import { apiGet, apiPost } from '../../lib/http'
import { generateIdempotencyKey } from '../../lib/idempotency'
import { isValidCPF, normalizeCPF } from '../../lib/cpf'

type NextDoc = {
  id: string
  title: string
  downloadUrl: string
}

type SignResponse = { hash?: string }

type Problem = { detail?: string }

type KnownError = { problem?: Problem; message?: string }

export default function Document() {
  const navigate = useNavigate()
  const [toast, setToast] = useState<string | undefined>()
  const [cpf, setCpf] = useState('')
  const [previewModal, setPreviewModal] = useState(false)
  const idemKey = useMemo(() => generateIdempotencyKey(), [])

  const { data, isLoading, refetch } = useQuery<NextDoc | null>({
    queryKey: ['user-next-doc'],
    queryFn: async () => {
      const res = await apiGet<NextDoc | null>('/user/documents/next')
      return res
    },
  })

  useEffect(() => {
    if (!isLoading && !data) {
      // no-op
    }
  }, [isLoading, data])

  const onSign = async () => {
    try {
      if (!data) return
      const nc = normalizeCPF(cpf)
      if (!isValidCPF(nc)) {
        setToast('CPF inválido')
        return
      }
      const res = await apiPost<SignResponse>('/user/sign', { documentId: data.id, cpf: nc }, {
        headers: { 'Idempotency-Key': idemKey },
      })
      const hash = res?.hash
      if (hash) navigate(`/success?hash=${hash}`)
      else navigate('/success')
    } catch (e: unknown) {
      const err = e as KnownError
      const message = err?.problem?.detail ?? err?.message ?? 'Erro ao assinar'
      setToast(message)
      await refetch()
    }
  }

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Carregando...</p>
      </div>
    </div>
  )

  if (!data)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Empty title="Nenhum documento pendente" description="Você não possui documentos para assinar." />
      </div>
    )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                  <path d="M10 17l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" fill="white"/>
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">SecureSign</h1>
                <p className="text-xs text-gray-500">Assinatura Digital</p>
              </div>
            </div>

            {/* Botão Sair */}
            <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4
v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />

              </svg>
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <div className="w-full max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Documento para Assinatura</h2>
          <p className="text-gray-600">Revise o documento antes de assinar</p>
        </div>

        <Card className="shadow-2xl border-0 rounded-2xl">
          <CardContent className="p-6 sm:p-8">
                <div className="flex items-center space-x-3 mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />

                  </svg>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{data.title}</h3>
                    <p className="text-sm text-gray-500">Enviado em 15/01/2024</p>
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center mb-6">
                  <svg className="w-14 h-14 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="
0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-600 font-medium mb-4">Prévia do documento</p>
                  <div className="h-64 flex items-center justify-center">
                    <Button onClick={() => setPreviewModal(true)} variant="secondary" className="rounded-full bg-white text-gray-800 border border-gray-300 shadow-sm hover:bg-gray-100">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Ver Documento Completo
                    </Button>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <p className="text-sm text-yellow-800">
                      Após assinar, este documento não será mais exibido.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label htmlFor="cpf" className="block text-sm font-medium text-gray-700">
                    CPF para Assinar
                  </Label>
                  <Input
                    id="cpf"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    className="h-12 text-base rounded-lg"
                  />
                  <Button
                    onClick={onSign}
                    className="w-full h-12 text-base font-medium rounded-full text-white shadow-md bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-purple-300"
                  >
                    Assinar Documento
                  </Button>
                  <p className="text-xs text-gray-500 text-center">
                    Ao assinar, você concorda com os termos e condições e atesta a veracidade das informações.
                  </p>
                </div>
        </CardContent>
      </Card>
      </div>

      {previewModal && (
        <Modal
          open
          onClose={() => setPreviewModal(false)}
          title="Visualizar Documento"
          actions={
            <Button onClick={() => { window.open(data.downloadUrl, '_blank'); setPreviewModal(false) }} className="rounded-md px-4">OK</Button>
          }
        >
          <p className="text-sm text-gray-700">
            O documento "{data.title}" será aberto em uma nova janela para visualização completa. Esta ação não afetará o processo de assinatura.
          </p>
        </Modal>
      )}
      <Toast message={toast} type="error" onClose={() => setToast(undefined)} />
    </div>
  )
}
