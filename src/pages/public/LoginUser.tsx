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
import { normalizeCPF, isValidCPF } from '../../lib/cpf'
import { useNavigate, Link } from 'react-router-dom'

const schema = z.object({
  cpf: z.string().min(11, 'Informe seu CPF').refine(isValidCPF, 'CPF inválido'),
  password: z.string().min(6, 'Senha obrigatória'),
})

const formatCPF = (value: string): string => {
  const cleaned = value.replace(/\D/g, "")
  if (cleaned.length <= 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
  }
  return value
}

type FormValues = z.infer<typeof schema>

type LoginResp = { accessToken?: string }

type Session = { role?: string }

export default function LoginUser() {
  const navigate = useNavigate()
  const [toast, setToast] = useState<string | undefined>()
  const [cpfValue, setCpfValue] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value)
    setCpfValue(formatted)
    setValue('cpf', normalizeCPF(formatted), { shouldValidate: true })
  }

  const onSubmit = async (values: FormValues) => {
    try {
      const body = { identifier: normalizeCPF(values.cpf), password: values.password }
      const login = (await apiPost('/auth/login', body)) as LoginResp
      const accessToken: string | undefined = login?.accessToken
      if (accessToken) {
        localStorage.setItem('accessToken', accessToken)
      }
      const session = (await apiGet('/auth/session')) as Session
      if (session?.role === 'ADMIN') navigate('/admin/documents/new', { replace: true })
      else navigate('/document', { replace: true })
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
        <div className="flex justify-center">
          <Logo size="large" />
        </div>

        <div className="text-center space-y-2 mb-8">
          <h2 className="text-3xl font-bold text-gray-900 whitespace-nowrap">Bem-vindo</h2>
          <p className="text-gray-500 text-base">Acesse sua conta para assinar documentos</p>
        </div>

        <Card className="shadow-xl border-0">

          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="cpf" className="text-sm font-semibold text-gray-700">
                  CPF
                </Label>
                <Input 
                  id="cpf"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpfValue}
                  onChange={handleCpfChange}
                  className="h-12 border-gray-200 focus:border-primary focus:ring-primary/20"
                  maxLength={14}
                />
                {errors.cpf && <p className="text-sm text-red-600">{errors.cpf.message}</p>}
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

            <div className="text-center mt-6">
              <button className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                Esqueci minha senha
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="text-center">
                <Link
                  to="/admin/login"
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Acesso Administrativo
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
