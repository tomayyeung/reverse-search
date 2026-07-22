import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import { ui } from '@clerk/ui'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (clerkPublishableKey === undefined || clerkPublishableKey === "") {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

// Provider order keeps Clerk auth and browser routing available to every page.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={clerkPublishableKey} ui={ui}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>,
)
