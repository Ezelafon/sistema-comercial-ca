"use client";

import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type Profile = {
  id: string;
  full_name: string | null;
  role: "admin" | "seller" | "unit_lead" | "operations" | "viewer";
  status: "pending" | "active" | "disabled";
};

type Interaction = {
  id: string;
  raw_input: string;
  channel: string;
  occurred_at: string;
  ai_status: string;
};

const channels = [
  ["meeting", "Reunión"],
  ["visit", "Visita"],
  ["call", "Llamada"],
  ["email", "Email"],
  ["whatsapp", "WhatsApp"],
  ["portal", "Portal"],
] as const;

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadWorkspace(nextUser: User | null) {
    setUser(nextUser);
    if (!nextUser) {
      setProfile(null);
      setInteractions([]);
      setLoading(false);
      return;
    }

    const { data: nextProfile } = await supabase
      .from("profiles")
      .select("id, full_name, role, status")
      .eq("id", nextUser.id)
      .single();

    setProfile(nextProfile as Profile | null);
    if (nextProfile?.status === "active") {
      const { data } = await supabase
        .from("interactions")
        .select("id, raw_input, channel, occurred_at, ai_status")
        .order("occurred_at", { ascending: false })
        .limit(6);
      setInteractions((data ?? []) as Interaction[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => loadWorkspace(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      loadWorkspace(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <main className="loading">Preparando tu espacio…</main>;
  if (!user) return <Access onMessage={setMessage} message={message} />;
  if (!profile || profile.status !== "active") {
    return (
      <main className="access-shell">
        <section className="access-card pending-card">
          <Brand />
          <span className="status-pill">Acceso pendiente</span>
          <h1>Tu usuario ya fue registrado.</h1>
          <p>El administrador debe habilitarlo antes de que puedas consultar la información comercial compartida.</p>
          <button className="secondary-button" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav>
          <button className="nav-item active">Hoy</button>
          <button className="nav-item">Cuentas</button>
          <button className="nav-item">Contactos</button>
          <button className="nav-item">Funnel</button>
          <button className="nav-item">Mercado</button>
        </nav>
        <div className="user-card">
          <div className="avatar">{(profile.full_name ?? user.email ?? "U").slice(0, 1).toUpperCase()}</div>
          <div><strong>{profile.full_name ?? "Usuario CA"}</strong><span>{profile.role === "admin" ? "Administrador" : "Equipo comercial"}</span></div>
          <button aria-label="Cerrar sesión" onClick={() => supabase.auth.signOut()}>↗</button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><span className="eyebrow">Sistema Comercial CA</span><h1>¿Qué pasó hoy?</h1></div>
          <span className="shared-badge"><i /> Información compartida</span>
        </header>

        <section className="capture-card">
          <div className="capture-intro"><span className="spark">✦</span><div><h2>Contame una novedad</h2><p>Una reunión, una persona nueva, una necesidad o un próximo paso.</p></div></div>
          <NewInteraction userId={user.id} onSaved={() => loadWorkspace(user)} />
        </section>

        <div className="content-grid">
          <section>
            <div className="section-title"><div><span className="eyebrow">Actividad reciente</span><h2>Últimas interacciones</h2></div><button>Ver todas</button></div>
            <div className="interaction-list">
              {interactions.length === 0 ? (
                <div className="empty-state"><span>✦</span><h3>El conocimiento empieza con una conversación.</h3><p>Registrá la primera novedad para construir la historia comercial compartida.</p></div>
              ) : interactions.map((item) => (
                <article className="interaction-row" key={item.id}>
                  <span className="channel-dot">{item.channel.slice(0, 1).toUpperCase()}</span>
                  <div><strong>{item.raw_input}</strong><p>{new Date(item.occurred_at).toLocaleString("es-AR")}</p></div>
                  <span className="ai-pill">{item.ai_status === "pending" ? "IA pendiente" : item.ai_status}</span>
                </article>
              ))}
            </div>
          </section>

          <aside className="next-card">
            <span className="eyebrow">Construcción progresiva</span>
            <h2>Cada interacción suma.</h2>
            <p>El sistema organizará personas, cuentas, señales del mercado y oportunidades sin exigir información perfecta desde el inicio.</p>
            <div className="progress-item"><span>1</span><div><strong>Contás lo ocurrido</strong><small>Con tus palabras, por texto o voz.</small></div></div>
            <div className="progress-item"><span>2</span><div><strong>La IA estructura</strong><small>Identifica personas, datos y relaciones.</small></div></div>
            <div className="progress-item"><span>3</span><div><strong>Vos confirmás</strong><small>La información se comparte con el equipo.</small></div></div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Brand() {
  return <div className="brand"><span>CA</span><div><strong>Comercial Argentina</strong><small>Inteligencia comercial</small></div></div>;
}

function Access({ onMessage, message }: { onMessage: (value: string) => void; message: string }) {
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); onMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const fullName = String(form.get("fullName") ?? "");
    const result = signup
      ? await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
      : await supabase.auth.signInWithPassword({ email, password });
    onMessage(result.error ? result.error.message : signup ? "Revisá tu email para confirmar el registro." : "");
    setBusy(false);
  }

  return (
    <main className="access-shell">
      <section className="access-card">
        <Brand />
        <div className="access-copy"><span className="eyebrow">Conocimiento compartido</span><h1>{signup ? "Crear usuario" : "Volvé a la conversación."}</h1><p>{signup ? "Registrate para solicitar acceso al espacio comercial de CA." : "Ingresá para registrar novedades, construir contactos y continuar oportunidades junto al equipo."}</p></div>
        <form onSubmit={submit}>
          {signup && <label>Nombre completo<input name="fullName" required placeholder="Ezequiel Lafón" /></label>}
          <label>Email<input name="email" type="email" required placeholder="nombre@comercialargentina.com" /></label>
          <label>Contraseña<input name="password" type="password" minLength={8} required placeholder="Mínimo 8 caracteres" /></label>
          {message && <p className="form-message">{message}</p>}
          <button className="primary-button" disabled={busy}>{busy ? "Procesando…" : signup ? "Solicitar acceso" : "Ingresar"}</button>
        </form>
        <button className="text-button" onClick={() => { setSignup(!signup); onMessage(""); }}>{signup ? "Ya tengo usuario" : "Crear un usuario nuevo"}</button>
      </section>
      <aside className="access-quote"><span>✦</span><blockquote>“Cada interacción debe aumentar el conocimiento sobre el cliente y ayudar a definir el próximo paso.”</blockquote><small>Principio rector · Sistema Comercial CA</small></aside>
    </main>
  );
}

function NewInteraction({ userId, onSaved }: { userId: string; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [channel, setChannel] = useState("meeting");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function save() {
    if (!text.trim()) return;
    setSaving(true); setFeedback("");
    const { error } = await supabase.from("interactions").insert({ raw_input: text.trim(), channel, created_by: userId });
    if (error) setFeedback(error.message);
    else { setText(""); setFeedback("Novedad guardada en el espacio compartido."); onSaved(); }
    setSaving(false);
  }

  return <div className="capture-form">
    <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Ej.: Me reuní con Rocío de Halliburton. Están revisando proveedores para capacitaciones de espacios confinados…" />
    <div className="capture-actions"><div className="channel-select">{channels.map(([value, label]) => <button key={value} className={channel === value ? "selected" : ""} onClick={() => setChannel(value)}>{label}</button>)}</div><button className="primary-button compact" disabled={saving || !text.trim()} onClick={save}>{saving ? "Guardando…" : "Continuar con IA →"}</button></div>
    {feedback && <p className="capture-feedback">{feedback}</p>}
  </div>;
}
