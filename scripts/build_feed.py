"""Build podcast.xml (the podcast feed) from data/sermons.json + data/podcast.json.

Netlify runs this on every deploy (see netlify.toml), so the feed is always in step
with the sermon list. Apple Podcasts, Spotify, etc. read this feed and pick up new
sermons on their own. Run by hand with: python3 scripts/build_feed.py
"""
import datetime as dt
import json
import pathlib
from email.utils import format_datetime
from xml.sax.saxutils import escape, quoteattr
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parent.parent
cfg = json.loads((ROOT / "data/podcast.json").read_text())
sermons = json.loads((ROOT / "data/sermons.json").read_text())
site = cfg["site_url"].rstrip("/")
ohio = ZoneInfo("America/New_York")


def pub_date(iso):
    d = dt.date.fromisoformat(iso)
    return format_datetime(dt.datetime(d.year, d.month, d.day, 12, 0, tzinfo=ohio))


def seconds(hms):
    try:
        h, m, s = (int(x) for x in hms.split(":"))
        return h * 3600 + m * 60 + s
    except (ValueError, AttributeError):
        return 0


items = []
for s in sermons:
    if not s.get("audio"):
        continue
    # The guid must never change, even if the audio file moves, or apps re-download everything.
    guid = s.get("guid") or f"mtzion-{s['date']}-{s['audio'].rsplit('/', 1)[-1].rsplit('.', 1)[0]}"
    desc = " · ".join(x for x in [s.get("speaker"), s.get("passage"), dt.date.fromisoformat(s["date"]).strftime("%B %-d, %Y")] if x)
    secs = seconds(s.get("length", ""))
    items.append(f"""    <item>
      <title>{escape(s['title'])}</title>
      <description>{escape(desc)}</description>
      <itunes:author>{escape(s.get('speaker') or cfg['author'])}</itunes:author>
      <enclosure url={quoteattr(s['audio'])} length="{int(s.get('size') or 0)}" type="audio/mpeg"/>
      <guid isPermaLink="false">{escape(guid)}</guid>
      <pubDate>{pub_date(s['date'])}</pubDate>{f'''
      <itunes:duration>{secs}</itunes:duration>''' if secs else ''}
      <itunes:explicit>false</itunes:explicit>
    </item>""")

feed = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>{escape(cfg['title'])}</title>
    <link>{site}/sermons.html</link>
    <atom:link href="{site}/podcast.xml" rel="self" type="application/rss+xml"/>
    <language>{cfg['language']}</language>
    <description>{escape(cfg['description'])}</description>
    <itunes:subtitle>{escape(cfg['subtitle'])}</itunes:subtitle>
    <itunes:author>{escape(cfg['author'])}</itunes:author>
    <itunes:owner>
      <itunes:name>{escape(cfg['owner_name'])}</itunes:name>
      <itunes:email>{escape(cfg['owner_email'])}</itunes:email>
    </itunes:owner>
    <itunes:image href="{site}/{cfg['cover']}"/>
    <image><url>{site}/{cfg['cover']}</url><title>{escape(cfg['title'])}</title><link>{site}</link></image>
    <itunes:category text={quoteattr(cfg['category'])}>
      <itunes:category text={quoteattr(cfg['subcategory'])}/>
    </itunes:category>
    <itunes:explicit>false</itunes:explicit>
    <itunes:type>episodic</itunes:type>
{chr(10).join(items)}
  </channel>
</rss>
"""
(ROOT / "podcast.xml").write_text(feed)
print(f"podcast.xml: {len(items)} episodes")
