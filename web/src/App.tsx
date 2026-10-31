import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { EdgeBars } from './components/EdgeBars'
import { RequireAuth } from './components/RequireAuth'
import { BudgetDetail } from './routes/BudgetDetail'
import { BudgetList } from './routes/BudgetList'
import { Login } from './routes/Login'

export function App() {
  return (
    <BrowserRouter>
      <EdgeBars />
      <div className="mx-auto h-full max-w-[600px]">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<BudgetList />} />
            <Route path="/folder/:id" element={<BudgetList />} />
            <Route path="/budget/:id" element={<BudgetDetail />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
