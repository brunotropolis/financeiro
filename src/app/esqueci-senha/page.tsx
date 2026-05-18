"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/redefinir-senha`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      setError("Não foi possível enviar o email. Verifica se o endereço está correto.");
      setLoading(false);
    } else {
      setEnviado(true);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">💰 Gerenciador Financeiro</h1>
          <p className="text-gray-400 mt-2">Recuperar senha</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
          {enviado ? (
            <div className="text-center space-y-4">
              <div className="text-5xl">📧</div>
              <h2 className="text-lg font-semibold text-white">Email enviado!</h2>
              <p className="text-sm text-gray-400">
                Enviei um link de recuperação pro seu email. Confere a caixa de entrada e o spam.
              </p>
              <Link
                href="/login"
                className="inline-block mt-2 text-sm text-blue-400 hover:text-blue-300"
              >
                ← Voltar para login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-sm text-gray-400">
                Informa seu email e te mando um link de recuperação.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="seu@email.com"
                />
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                {loading ? "Enviando..." : "Enviar link"}
              </button>

              <div className="text-center pt-1">
                <Link
                  href="/login"
                  className="text-sm text-gray-400 hover:text-blue-400 transition-colors"
                >
                  ← Voltar para login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
