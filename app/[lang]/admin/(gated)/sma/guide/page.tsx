'use client'

import { useState } from 'react'

type Lang = 'es' | 'en'

export default function GuidePage() {
  const [lang, setLang] = useState<Lang>('es')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setLang('es')}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
            lang === 'es'
              ? 'bg-zinc-900 text-white'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          Español
        </button>
        <button
          type="button"
          onClick={() => setLang('en')}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
            lang === 'en'
              ? 'bg-zinc-900 text-white'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          English
        </button>
      </div>

      <article className="rounded-2xl border border-zinc-200 bg-white p-6">
        {lang === 'es' ? <GuideEs /> : <GuideEn />}
      </article>
    </div>
  )
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 text-xl font-semibold text-zinc-900 first:mt-0">{children}</h2>
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-zinc-700">{children}</p>
}

function Steps({ children }: { children: React.ReactNode }) {
  return (
    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-700">
      {children}
    </ol>
  )
}

function Bullets({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700">
      {children}
    </ul>
  )
}

function GuideEs() {
  return (
    <div>
      <H>Qué es el Agente de Redes Sociales</H>
      <P>
        El Agente de Redes Sociales (SMA) es un asistente que te ayuda a crear publicaciones para
        las cuentas de CEPTI. Redacta borradores de texto e imágenes, los deja listos para que tú
        los revises y, cuando apruebas, publica en las cuentas de CEPTI (Facebook e Instagram) con
        el enlace de WhatsApp incluido. El agente nunca publica solo: tú siempre tienes la última palabra.
      </P>

      <H>El flujo principal</H>
      <Steps>
        <li>
          Ve a <strong>Queue (Cola)</strong> y elige un producto, las plataformas y el material
          (foto o video) que quieres usar.
        </li>
        <li>
          Pulsa <strong>Generar Borradores</strong>. El agente escribe el texto y prepara la
          publicación.
        </li>
        <li>
          Los borradores aparecen en la <strong>Cola de Aprobación (Approval Queue)</strong>.
        </li>
        <li>
          Revisa cada borrador y pulsa <strong>Aprobar</strong>, indicando un motivo (por ejemplo,
          &quot;texto correcto, foto buena&quot;).
        </li>
        <li>
          El borrador aprobado pasa a <strong>Listo para Publicar (Ready to Publish)</strong>.
        </li>
        <li>
          Pulsa <strong>Publicar</strong> en la plataforma que quieras (Facebook o Instagram). Se
          publica en la cuenta de CEPTI con el enlace de WhatsApp incluido. (Instagram requiere la
          aprobación de Meta &mdash; App Review &mdash; antes de poder publicar en producción.)
        </li>
        <li>
          Vigila WhatsApp: ahí llegarán las respuestas de los clientes interesados.
        </li>
      </Steps>

      <H>Estudio de Video (beta)</H>
      <P>
        En el Estudio de Video puedes crear clips cortos de dos maneras:
      </P>
      <Bullets>
        <li>Elige un producto para animar su imagen, o</li>
        <li>
          Sube una foto de una pared vacía (el &quot;antes&quot;) para generar una transición de
          antes y después.
        </li>
      </Bullets>
      <P>
        Cada clip cuesta aproximadamente $0.50. Cuando esté listo, aparecerá en la lista de
        trabajos recientes.
      </P>

      <H>Biblioteca de Ejemplos (Settings)</H>
      <P>
        En la sección de <strong>Ajustes (Settings)</strong> puedes guardar tus mejores textos
        (captions). El agente imita ese estilo cuando redacta borradores nuevos, así que mientras
        más buenos ejemplos guardes, mejor sonará.
      </P>

      <H>Conexiones</H>
      <P>
        En <strong>Conexiones (Connections)</strong> autorizas las cuentas de Facebook e Instagram
        para que el agente pueda actuar en ellas. Sin esta autorización, el agente no puede
        publicar.
      </P>

      <H>El Tablero (Dashboard)</H>
      <Bullets>
        <li>
          <strong>Pipeline:</strong> cuántas veces se generó contenido (Runs), cuántos se aprobaron
          y cuántos se publicaron, más el porcentaje de aprobación.
        </li>
        <li>
          <strong>Cadencia:</strong> cuántas publicaciones salieron en los últimos 7 días y cuántos
          días han pasado desde la última.
        </li>
        <li>
          <strong>Publicaciones recientes:</strong> las últimas 5, con enlace para verlas.
        </li>
        <li>
          <strong>Video:</strong> cuántos clips se completaron, fallaron o están en proceso, y el
          gasto estimado.
        </li>
      </Bullets>

      <H>Reglas de seguridad</H>
      <P>
        Nada se publica de forma automática. Cada publicación pasa por tu aprobación. El agente solo
        redacta: tú decides qué sale al público.
      </P>

      <H>Asesor de WhatsApp</H>
      <P>
        En la pestaña <strong>WhatsApp</strong> ves las conversaciones del Asesor: un bot que
        responde preguntas de producto por WhatsApp de forma automática, dentro de límites estrictos
        (nunca da precios ni cotizaciones &mdash; eso lo pasa a una persona). Puedes tomar el control
        de cualquier conversación con <strong>Tomar control</strong>. Aún no está activo: falta
        conectar el número (Coexistence) para que entre en funcionamiento.
      </P>

      <H>Aún no disponible</H>
      <Bullets>
        <li>Publicación en Threads.</li>
        <li>Respuestas automáticas a comentarios (el agente todavía no responde comentarios solo).</li>
        <li>Atribución automática de leads de WhatsApp (por ahora se registran a mano).</li>
      </Bullets>
    </div>
  )
}

function GuideEn() {
  return (
    <div>
      <H>What the Social Media Agent is</H>
      <P>
        The Social Media Agent (SMA) is an assistant that helps you create posts for CEPTI&apos;s
        accounts. It drafts captions and images, sets them aside for you to review, and once you
        approve, publishes to CEPTI&apos;s accounts (Facebook and Instagram) with the WhatsApp link
        included. The agent never posts on its own — you always have the final say.
      </P>

      <H>The core loop</H>
      <Steps>
        <li>
          Go to <strong>Queue</strong> and pick a product, the platforms, and the media (photo or
          video) you want to use.
        </li>
        <li>
          Click <strong>Generate Drafts</strong>. The agent writes the caption and prepares the
          post.
        </li>
        <li>
          The drafts show up in the <strong>Approval Queue</strong>.
        </li>
        <li>
          Review each draft and click <strong>Approve</strong>, adding a reason (for example,
          &quot;caption is right, photo looks good&quot;).
        </li>
        <li>
          The approved draft moves to <strong>Ready to Publish</strong>.
        </li>
        <li>
          Click <strong>Publish</strong> on the platform you want (Facebook or Instagram). It posts
          to the CEPTI account with the WhatsApp link included. (Instagram requires Meta approval
          &mdash; App Review &mdash; before it can publish in production.)
        </li>
        <li>Watch WhatsApp — that&apos;s where interested customers reply.</li>
      </Steps>

      <H>Video Studio (beta)</H>
      <P>In Video Studio you can create short clips two ways:</P>
      <Bullets>
        <li>Pick a product to animate its image, or</li>
        <li>
          Upload a bare-wall &quot;before&quot; photo to generate a before-and-after reveal.
        </li>
      </Bullets>
      <P>
        Each clip costs about $0.50. When it&apos;s ready, it appears under Recent jobs.
      </P>

      <H>Examples library (Settings)</H>
      <P>
        Under <strong>Settings</strong> you can save your best captions. The agent imitates that
        style when it writes new drafts, so the more good examples you save, the better it sounds.
      </P>

      <H>Connections</H>
      <P>
        Under <strong>Connections</strong> you authorize the Facebook and Instagram accounts so the
        agent can act on them. Without this authorization, the agent cannot post.
      </P>

      <H>The Dashboard</H>
      <Bullets>
        <li>
          <strong>Pipeline:</strong> how many times content was generated (Runs), how many were
          approved, and how many were published, plus the approval rate.
        </li>
        <li>
          <strong>Cadence:</strong> how many posts went out in the last 7 days and how many days
          since the last one.
        </li>
        <li>
          <strong>Recent posts:</strong> the last 5, with a link to view them.
        </li>
        <li>
          <strong>Video:</strong> how many clips were completed, failed, or are in progress, and the
          estimated spend.
        </li>
      </Bullets>

      <H>Guardrails</H>
      <P>
        Nothing posts automatically. Every post goes through your approval. The agent only drafts —
        you decide what goes public.
      </P>

      <H>WhatsApp Advisor</H>
      <P>
        The <strong>WhatsApp</strong> tab shows the Advisor&apos;s conversations: a bot that answers
        product questions on WhatsApp automatically, within strict limits (it never gives prices or
        quotes &mdash; it hands those to a person). You can take over any conversation with
        <strong>Take over</strong>. It is not live yet: the number still needs to be connected
        (Coexistence) before it runs.
      </P>

      <H>Not available yet</H>
      <Bullets>
        <li>Threads publishing.</li>
        <li>Auto-posting replies to comments (the agent does not reply to comments on its own yet).</li>
        <li>Automatic WhatsApp lead attribution (logged by hand for now).</li>
      </Bullets>
    </div>
  )
}
