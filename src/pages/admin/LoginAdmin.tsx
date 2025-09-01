import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Label from '../../components/ui/Label'
import { Card, CardContent } from '../../components/ui/Card'
import Logo from '../../components/Logo'
import Toast from '../../components/Toast'
import { apiGet, apiPost } from '../../lib/http'
import { useNavigate, Link } from 'react-router-dom'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha obrigatória'),
})

type FormValues = z.infer<typeof schema>

export default function LoginAdmin() {
  const navigate = useNavigate()
  const [toast, setToast] = useState<string | undefined>()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    try {
      const login = await apiPost('/auth/login', { identifier: values.email, password: values.password }) as { accessToken?: string }

      const accessToken: string | undefined = login?.accessToken
      if (accessToken) {
        localStorage.setItem('accessToken', accessToken)
      }
      // Buscar a sessão para decidir redirect (usa base configurada)
      const data = (await apiGet('/auth/session')) as { role?: string }
      if (data?.role === 'ADMIN') navigate('/admin/documents/new', { replace: true })
      else navigate('/admin/signatures', { replace: true })
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'problem' in e && (e as { problem?: { detail?: string } }).problem?.detail
        ? (e as { problem?: { detail?: string } }).problem!.detail as string
        : e instanceof Error
          ? e.message
          : 'Erro ao fazer login'
      setToast(message)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6"> 
      <div className="w-full max-w-md mx-auto space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <Logo size="large" />
        </div>

        {/* Título centralizado fora do card */}
        <div className="text-center space-y-2 mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Área Administrativa</h2>
          <p className="text-gray-500 text-base">Acesso para gestão de documentos</p>
        </div>

        {/* Card de Login */}
        <Card className="shadow-xl border-0">

          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-gray-700">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email" 
                  placeholder="admin@empresa.com"
                  className="h-12 border-gray-200 focus:border-primary focus:ring-primary/20"
                  {...register('email')}
                />
                {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                  Senha
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Digite sua senha"
                  className="h-12 border-gray-200 focus:border-primary focus:ring-primary/20"
                  {...register('password')}
                />
                {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 bg-primary hover:bg-primary/90 font-semibold text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  {isSubmitting ? 'Entrando...' : 'Entrar'}
                </Button>
              </div>
            </form>

            {/* Divisor e Link Voltar */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="text-center">
                <Link
                  to="/login"
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Voltar ao Login de Usuário
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Toast message={toast} type="error" onClose={() => setToast(undefined)} />
    </div>
  )
}
