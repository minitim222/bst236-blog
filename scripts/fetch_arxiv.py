"""
Fetch latest arXiv papers and render a static HTML page.

This script:
- Calls the arXiv API for a set of keywords
- Parses the Atom XML feed
- Renders `arxiv.html` from `arxiv_template.html`

It is designed to be run from GitHub Actions on a schedule.
"""

from __future__ import annotations

import datetime as _dt
import html
import pathlib
import textwrap
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[1]
TEMPLATE_PATH = ROOT / "arxiv_template.html"
OUTPUT_PATH = ROOT / "arxiv.html"


def build_query_url(keywords: list[str], max_results: int = 20) -> str:
  """
  Build an arXiv API query URL.

  See: https://arxiv.org/help/api/user-manual
  """

  # Example: (ti:deep+learning OR ti:reinforcement)
  # Here we search titles and abstracts for the keywords.
  parts = [f"(ti:{kw} OR abs:{kw})" for kw in keywords]
  query = " OR ".join(parts)

  params = {
      "search_query": query,
      "sortBy": "submittedDate",
      "sortOrder": "descending",
      "max_results": str(max_results),
  }

  return "https://export.arxiv.org/api/query?" + urllib.parse.urlencode(params)


def fetch_arxiv_feed(url: str) -> str:
  req = urllib.request.Request(
      url,
      headers={
          "User-Agent": "BST236-hw1-arxiv-fetcher (contact: example@example.com)",
      },
  )
  with urllib.request.urlopen(req, timeout=30) as resp:
    return resp.read().decode("utf-8", errors="replace")


def parse_entries(atom_xml: str) -> list[dict]:
  ns = {"atom": "http://www.w3.org/2005/Atom"}
  root = ET.fromstring(atom_xml)
  entries = []
  for entry in root.findall("atom:entry", ns):
    title = (entry.findtext("atom:title", default="", namespaces=ns) or "").strip()
    abstract = (entry.findtext("atom:summary", default="", namespaces=ns) or "").strip()
    updated = entry.findtext("atom:updated", default="", namespaces=ns) or ""

    # Authors
    authors = []
    for a in entry.findall("atom:author", ns):
      name = a.findtext("atom:name", default="", namespaces=ns) or ""
      name = name.strip()
      if name:
        authors.append(name)

    # PDF link
    pdf_url = ""
    for link in entry.findall("atom:link", ns):
      if link.attrib.get("type") == "application/pdf":
        pdf_url = link.attrib.get("href", "")
        break

    entries.append(
        {
            "title": title,
            "abstract": abstract,
            "authors": authors,
            "updated": updated,
            "pdf_url": pdf_url,
        }
    )

  return entries


def render_items(entries: list[dict]) -> str:
  if not entries:
    return """
    <p style="font-size:0.9rem;color:#9ca3af;margin:0.4rem 0 0;">
      No papers were returned from the arXiv API for the current query.
      This could be a temporary network issue or simply no recent matches.
    </p>
    """

  rendered = []
  for e in entries:
    title = html.escape(e["title"])
    abstract = html.escape(" ".join(e["abstract"].split()))
    authors = ", ".join(map(html.escape, e["authors"])) or "Unknown authors"

    # Convert updated datetime to a nicer format if possible
    pretty_date = e["updated"]
    try:
      dt = _dt.datetime.fromisoformat(e["updated"].replace("Z", "+00:00"))
      pretty_date = dt.strftime("%Y-%m-%d")
    except Exception:
      pass

    pdf_link = html.escape(e["pdf_url"] or "")

    block = f"""
    <article class="paper-card">
      <h3 class="paper-title">
        <a href="{pdf_link}" target="_blank" rel="noopener noreferrer">
          {title}
        </a>
      </h3>
      <p class="paper-meta">
        <span class="paper-authors">{authors}</span>
        <span class="paper-dot">•</span>
        <span class="paper-date">{pretty_date}</span>
      </p>
      <p class="paper-abstract">{abstract}</p>
      <a class="paper-link" href="{pdf_link}" target="_blank" rel="noopener noreferrer">
        View PDF →
      </a>
    </article>
    """
    rendered.append(textwrap.dedent(block).strip())

  return "\n\n".join(rendered)


def main() -> None:
  # Choose your own keywords here.
  keywords = ["statistics", "causal+inference", "machine+learning"]
  url = build_query_url(keywords, max_results=20)
  xml_text = fetch_arxiv_feed(url)
  entries = parse_entries(xml_text)

  template = TEMPLATE_PATH.read_text(encoding="utf-8")

  now = _dt.datetime.utcnow().replace(microsecond=0)
  last_updated = now.strftime("%Y-%m-%d %H:%M UTC")
  query_description = ", ".join(keywords)

  html_items = render_items(entries)

  output_html = (
      template.replace("{{PAPER_ITEMS}}", html_items)
      .replace("{{LAST_UPDATED}}", html.escape(last_updated))
      .replace("{{QUERY_DESCRIPTION}}", html.escape(query_description))
  )

  OUTPUT_PATH.write_text(output_html, encoding="utf-8")


if __name__ == "__main__":
  main()

