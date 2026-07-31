import React from 'react'

const TIBETAN_RE = /[ༀ-࿿]/

// Single-pass tokenizer: bold → em → tibetan runs
function tokenizeLine(text: string): React.ReactNode[] {
  const re = /\*\*([^*]+?)\*\*|\*([^*]+?)\*|([ༀ-࿿][ༀ-࿿\s]*)/g
  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null

  re.lastIndex = 0
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    if (match[1] !== undefined) {
      nodes.push(<strong key={key++}>{match[1]}</strong>)
    } else if (match[2] !== undefined) {
      nodes.push(<em key={key++}>{match[2]}</em>)
    } else {
      nodes.push(
        <span key={key++} className="font-tibetan">
          {match[3]}
        </span>,
      )
    }
    lastIndex = re.lastIndex
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }
  return nodes
}

/** Render Tibetan-aware markdown text into React nodes. */
export function TibetanText({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/)

  return (
    <>
      {paragraphs.map((para, pi) => {
        const lines = para.split('\n')
        return (
          <p key={pi} className="mb-2 last:mb-0">
            {lines.map((line, li) => {
              const hasTibetan = TIBETAN_RE.test(line)
              const isPhraseLine = hasTibetan && line.includes('—')
              const content = tokenizeLine(line)

              if (isPhraseLine) {
                return (
                  <span key={li} className="block py-0.5">
                    {content}
                  </span>
                )
              }
              return (
                <React.Fragment key={li}>
                  {content}
                  {li < lines.length - 1 && <br />}
                </React.Fragment>
              )
            })}
          </p>
        )
      })}
    </>
  )
}
