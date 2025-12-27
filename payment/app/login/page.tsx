'use client'

import { useActionState } from 'react'
import { authenticate, googleAuthenticate } from '@/lib/actions/auth'

export default function Page() {
    const [errorMessage, dispatch] = useActionState(authenticate, undefined)

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100">
            <div className="w-full max-w-md space-y-8 bg-white p-8 rounded shadow">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
                        Sign in to your account
                    </h2>
                </div>
                <form action={dispatch} className="mt-8 space-y-6">
                    <div className="-space-y-px rounded-md shadow-sm">
                        <div>
                            <label htmlFor="email-address" className="sr-only">
                                Email address
                            </label>
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                required
                                className="relative block w-full rounded-t-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 p-2"
                                placeholder="Email address"
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="relative block w-full rounded-b-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 p-2"
                                placeholder="Password"
                            />
                        </div>
                        <input type="hidden" name="redirectTo" value="/" />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="text-sm">
                            <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                                Forgot your password?
                            </a>
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            className="group relative flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        >
                            Sign in
                        </button>
                    </div>
                    <div
                        className="flex h-8 items-end space-x-1"
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        {errorMessage && (
                            <p className="text-sm text-red-500">{errorMessage}</p>
                        )}
                    </div>
                </form>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="bg-white px-2 text-gray-500">Or continue with</span>
                    </div>
                </div>

                <form action={googleAuthenticate}>
                    <button
                        type="submit"
                        className="flex w-full items-center justify-center gap-3 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:ring-transparent"
                    >
                        <svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
                            <path
                                d="M12.0003 20.4502C16.8003 20.4502 20.8503 17.0502 22.3503 12.7502H12.0003V9.75019H22.9003C23.0503 10.3002 23.1503 10.9502 23.1503 11.6002C23.1503 18.0002 18.2503 22.5002 12.0003 22.5002C6.20033 22.5002 1.50033 17.8002 1.50033 12.0002C1.50033 6.20019 6.20033 1.50019 12.0003 1.50019C14.8003 1.50019 17.1503 2.50019 18.9503 4.20019L16.2003 6.95019C15.4503 6.25019 14.1003 5.40019 12.0003 5.40019C8.35033 5.40019 5.40033 8.35019 5.40033 12.0002C5.40033 15.6502 8.35033 18.6002 12.0003 18.6002C15.6003 18.6002 17.6503 16.1002 18.1503 13.7002H12.0003V12.7502V20.4502Z"
                                fill="#4285F4"
                            />
                        </svg>
                        <span className="text-sm font-semibold leading-6">Sign in with Google</span>
                    </button>
                </form>
                <div className="text-center text-sm text-gray-500">
                    <p>Admin: admin@patrickcoin.com / password</p>
                    <p>User: user@example.com / password</p>
                </div>
            </div>
        </div>
    )
}
