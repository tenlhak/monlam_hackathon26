import { useAuth } from '@/features/auth/AuthContext'
import { SignIn } from '@/features/auth/SignIn'
import { TutorShell } from '@/features/chat/TutorShell'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <span className="font-tibetan text-3xl animate-pulse">བཀྲ་ཤིས།</span>
      </div>
    )
  }

  if (!user) {
    return <SignIn />
  }

  return <TutorShell />
}

export default App
