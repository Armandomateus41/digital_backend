import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Label from '../../components/ui/Label'
import { Card, CardContent } from '../../components/ui/Card'
import Toast from '../../components/Toast'
import { apiPostForm } from '../../lib/http'
import { Link, useNavigate } from 'react-router-dom'
import Modal from '../../components/ui/Modal'

const schema = z.object({
  title: z.string().min(1, 'Título obrigatório'),
  file: z.instanceof(File, { message: 'Selecione um PDF' }),
})

type FormValues = z.infer<typeof schema>

type Problem = { detail?: string }

type KnownError = { problem?: Problem; requestId?: string; message?: string }

export default function UploadDocument() {
  const navigate = useNavigate()
  const [toast, setToast] = useState<string | undefined>()
  const [showExit, setShowExit] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    try {
      const fd = new FormData()
      fd.set('title', values.title)
      fd.set('file', values.file)
      await apiPostForm('/admin/documents', fd)
      setToast('Documento enviado com sucesso')
    } catch (e: unknown) {
      const err = e as KnownError
      const rid = err?.requestId ? ` (reqId: ${err.requestId})` : ''
      // eslint-disable-next-line no-console
      console.error('Upload error', e)
      const msg = err?.problem?.detail ?? err?.message ?? 'Erro ao enviar'
      setToast(msg + rid)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo e Título */}
            <div className="flex items-center space-x-4">
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
              <div className="border-l border-gray-300 pl-4">
                <h2 className="text-lg font-semibold text-gray-900">Área Administrativa</h2>
                <p className="text-sm text-gray-600">Gerenciar documentos e assinaturas</p>
              </div>
            </div>

            {/* Botão Sair */}
            <Button
              variant="ghost"
              className="text-gray-600 hover:text-gray-900"
              onClick={() => setShowExit(true)}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4
v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />

              </svg>
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Navegação (tabs arredondadas) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="w-full rounded-full border border-gray-300 bg-white px-5 py-2.5 flex items-center justify
center shadow-sm">

            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap
="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>

            <span className="text-sm font-medium text-gray-800">Cadastrar Documento</span>
          </div>
          <Link to="/admin/signatures" className="block">
            <div className="w-full rounded-full border border-gray-300 bg-white px-5 py-2.5 flex items-center justi
fy-center hover:bg-gray-50 shadow-sm">

              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinec
ap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01
.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>

              <span className="text-sm font-medium text-gray-800">Lista de Assinaturas</span>
            </div>
          </Link>
        </div>

        {/* Conteúdo Principal */}
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-lg border-0">
            <CardContent className="p-8">
              {/* Título da Seção */}
              <div className="mb-8">
                <div className="flex items-center space-x-3 mb-4">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />

                  </svg>
                  <h3 className="text-2xl font-bold text-gray-900">Cadastro de Documento</h3>
                </div>
                <p className="text-gray-600">Faça upload de documentos PDF para disponibilizar para assinatura</p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <Label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                    Título do Documento
                  </Label>
                  <Input
                    id="title"
                    placeholder="Ex: Contrato de Prestação de Serviços"
                    className="h-12 text-base"
                    {...register('title')}
                  />
                  {errors.title && <p className="mt-2 text-sm text-red-600">{errors.title.message}</p>}
                </div>

                <div>
                  <Label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-2">
                    Selecionar PDF
                  </Label>
                  <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:
border-gray-400 transition-colors">

                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox
="0 0 24 24">

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.90
3A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />

                    </svg>
                    <p className="text-lg font-medium text-gray-900 mb-2">Clique para selecionar um arquivo PDF</p>
                    <p className="text-sm text-gray-500">Apenas arquivos PDF são aceitos</p>
                    <input
                      id="file"
                      type="file"
                      accept="application/pdf"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) setValue('file', f, { shouldValidate: true })
                      }}
                    />
                  </div>
                  {errors.file && <p className="mt-2 text-sm text-red-600">{errors.file.message as string}</p>}

                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 text-base font-medium rounded-full bg-gray-600 hover:bg-gray-700 text-white"
                >
                  {isSubmitting ? 'Cadastrando...' : 'Cadastrar Documento'}
                </Button>

                <Link to="/admin/signatures" className="block">
                  <div className="w-full rounded-full border border-gray-300 bg-white px-5 py-3 flex items-center j
ustify-center text-gray-800">

                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strok
eLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="
round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.2
74 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>

                    Verificar Assinantes Pendentes
                  </div>
                </Link>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
      {showExit && (
        <Modal
          open
          onClose={() => setShowExit(false)}
          title={<div className="flex items-center gap-2 text-gray-900"><svg className="w-5 h-5 text-yellow-600" fi
ll="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth=
{2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.14 0 1.86-1.23 1.29-2.23L13.29 4.77c-.57-1-2-1-2.58 0L3.78 16.77C3.21 17.77
3.93 19 5.07 19z"/></svg><span>Confirmar Saída</span></div>}

          actions={
            <>
              <Button variant="secondary" onClick={() => setShowExit(false)}>Cancelar</Button>
              <Button onClick={async () => { try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }) } catch (_e) { /* noop */ }; localStorage.removeItem('accessToken'); navigate('/admin/login', { replace: true }) }}>Sair</Button>

            </>
          }
        >
          <p className="text-sm text-gray-700">Tem certeza que deseja sair da área administrativa? Todas as altera
ções não salvas serão perdidas.</p>

        </Modal>
      )}

      <Toast message={toast} type={toast?.includes('sucesso') ? 'success' : 'error'} onClose={() => setToast(undefined)} />

    </div>
  )
}
