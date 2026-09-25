import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  ArrowRight,
  Box,
  Check,
  ChevronDown,
  Command,
  FileText,
  Folder,
  GitBranch,
  LockKeyhole,
  MessageCircle,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "Spacie — Good work starts with a shared space",
  description:
    "A calm, collaborative workspace for your files, your people, and your AI teammates. Give every idea room to become something.",
};
const workspace = "/workspace";

function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Spacie home"
      className={`${styles.brand} ${light ? styles.lightBrand : ""}`}
    >
      <Box strokeWidth={1.65} />
      <span>spacie</span>
    </Link>
  );
}
export default function LandingPage() {
  return (
    <div className={styles.landing}>
      <a href="#content" className={styles.skip}>
        Skip to content
      </a>
      <header className={styles.header}>
        <Brand />
        <nav aria-label="Main navigation" className={styles.nav}>
          <a href="#product">The workspace</a>
          <a href="#teammates">AI teammates</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <Link href={workspace} className={styles.navCta}>
          Open Spacie <ArrowUpRight size={15} />
        </Link>
      </header>
      <main id="content" className={styles.main}>
        <section className={styles.hero}>
          <a href="#teammates" className={styles.eyebrow}>
            <span className={styles.eyebrowMark}>
              <Sparkles size={13} />
            </span>
            A new kind of working together <ArrowRight size={13} />
          </a>
          <h1>
            Great minds.
            <br />
            <span>One shared space.</span>
          </h1>
          <p>
            A home for your files, your people, and your AI teammates.
            <br className={styles.desktopBreak} /> Less passing things around.
            More moving things forward.
          </p>
          <div className={styles.heroActions}>
            <Link href={workspace} className={styles.primary}>
              Step into your workspace <ArrowUpRight size={17} />
            </Link>
            <a href="#product" className={styles.secondary}>
              Take a closer look <ArrowRight size={16} />
            </a>
          </div>
          <div className={styles.heroNote}>
            <span className={styles.tinyPeople}>
              <i>LT</i>
              <i>SK</i>
              <i>✳</i>
              <i>◈</i>
            </span>
            For the whole team. Even the non-human ones.
          </div>
        </section>
        <section
          className={styles.productStage}
          id="product"
          aria-label="Inside the Spacie workspace"
        >
          <div className={styles.stageCaption}>
            <span>
              <span className={styles.captionDot} /> A little clarity. A lot of
              possibility.
            </span>
            <span>YOUR NEXT CHAPTER STARTS HERE ↘</span>
          </div>
          <div className={styles.previewFrame}>
            <div className={styles.previewBar}>
              <div>
                <i />
                <i />
                <i />
              </div>
              <span>
                <LockKeyhole size={10} /> spacie / your workspace
              </span>
              <Box size={13} />
            </div>
            <Link
              href={workspace}
              className={styles.previewLink}
              aria-label="Open the workspace shown in this preview"
            >
              <Image
                src="/workspace-preview-blue.png"
                alt="Spacie workspace: the Rebond strategy document, shared project folders, human and AI teammates, and a conversation between Sarah and Claude Code."
                width={1440}
                height={1223}
                priority
                sizes="(max-width: 700px) 100vw, 1120px"
              />
            </Link>
          </div>
          <div className={styles.previewFoot}>
            <span>
              <Command size={14} /> Familiar from the first click.
            </span>
            <Link href={workspace}>
              Make yourself at home <ArrowUpRight size={15} />
            </Link>
          </div>
        </section>
        <section className={styles.statement}>
          <span className={styles.sectionLabel}>
            A PLACE FOR THE WORK, AND EVERYONE BEHIND IT
          </span>
          <h2>
            Your best work doesn’t
            <br />
            happen <em>in a vacuum.</em>
          </h2>
          <p>
            It happens between a first draft and a fresh perspective.
            <br className={styles.desktopBreak} /> Between your team and the
            tools that think with you.
            <br className={styles.desktopBreak} /> Spacie brings it all into the
            same room.
          </p>
        </section>
        <section
          className={styles.features}
          aria-label="What you can do with Spacie"
        >
          <article className={styles.feature}>
            <div
              className={styles.folderExample}
              aria-label="Example project files"
            >
              <div>
                <Box size={18} />
                <strong>Rebond</strong>
                <ChevronDown size={13} />
              </div>
              <div>
                <Folder size={18} />
                Branding<span>5 files</span>
              </div>
              <div>
                <Folder size={18} />
                Campaigns<span>8 files</span>
              </div>
              <div>
                <FileText size={18} />
                The next big idea.md<span>Just now</span>
              </div>
            </div>
            <span className={styles.featureNumber}>
              01 / A HOME FOR EVERYTHING
            </span>
            <h3>
              Less hunting.
              <br />
              More doing.
            </h3>
            <p>
              Projects, documents, and assets in one thoughtful place. Find what
              you need, then get back to making something good.
            </p>
          </article>
          <article className={styles.feature}>
            <div
              className={styles.commentExample}
              aria-label="Example collaborative conversation"
            >
              <div>
                <span className={styles.sarah}>SK</span>
                <strong>Sarah</strong>
                <small>2 min ago</small>
              </div>
              <p>
                This direction feels right. Let’s make the opening a little
                bolder.
              </p>
              <div className={styles.exampleReply}>
                <span className={styles.claude}>✳</span>
                <div>
                  <strong>
                    Claude Code <b>AI</b>
                  </strong>
                  <p>On it. Three new directions, saved in version 4.</p>
                </div>
              </div>
            </div>
            <span className={styles.featureNumber}>
              02 / THE CONVERSATION STAYS CLOSE
            </span>
            <h3>
              Good feedback.
              <br />
              In the right place.
            </h3>
            <p>
              Keep the conversation beside the work. Share a thought, explore a
              version, and see how an idea got here.
            </p>
          </article>
          <article className={styles.feature}>
            <div
              className={styles.historyExample}
              aria-label="Example version history"
            >
              <div>
                <span className={styles.versionIcon}>
                  <GitBranch size={17} />
                </span>
                <div>
                  <strong>
                    Version 4 <b>Current</b>
                  </strong>
                  <small>Claude Code · Refined the direction</small>
                </div>
                <Check size={15} />
              </div>
              <div>
                <span className={styles.versionIcon}>
                  <GitBranch size={17} />
                </span>
                <div>
                  <strong>Version 3</strong>
                  <small>Sarah · A fresh perspective</small>
                </div>
              </div>
              <div>
                <span className={styles.versionIcon}>
                  <GitBranch size={17} />
                </span>
                <div>
                  <strong>Version 2</strong>
                  <small>Lorenzo · The first good idea</small>
                </div>
              </div>
            </div>
            <span className={styles.featureNumber}>
              03 / EVERY CHANGE HAS A STORY
            </span>
            <h3>
              Move forward.
              <br />
              Keep the history.
            </h3>
            <p>
              Know who changed what — human or agent. Previous versions stay
              within reach, so a new direction never means losing the old one.
            </p>
          </article>
        </section>
        <section className={styles.agentsSection} id="teammates">
          <div className={styles.agentsCopy}>
            <span className={styles.sectionLabel}>MEET YOUR EXTENDED TEAM</span>
            <h2>
              A seat at the table.
              <br />
              <em>For your AI, too.</em>
            </h2>
            <p>
              Your agents deserve more than a copy-pasted brief. Give them
              access to the actual work, with an identity, clear permissions,
              and a history you can follow.
            </p>
            <ul>
              <li>
                <Check size={16} />
                Connect Claude Code, Codex, or an MCP client
              </li>
              <li>
                <Check size={16} />
                Choose their projects and permissions
              </li>
              <li>
                <Check size={16} />
                See their changes, comments, and versions
              </li>
            </ul>
            <Link href={workspace} className={styles.textLink}>
              Meet your new teammates <ArrowUpRight size={17} />
            </Link>
          </div>
          <div
            className={styles.agentDemo}
            aria-label="Example agent permissions"
          >
            <div className={styles.agentDemoTop}>
              <Users size={17} />
              <span>Your team, a little expanded.</span>
              <Plus size={16} />
            </div>
            <div className={styles.agentIdentity}>
              <span>✳</span>
              <div>
                <h3>Claude Code</h3>
                <p>
                  AI teammate <span>·</span> Anthropic
                </p>
              </div>
              <span className={styles.agentPill}>Connected</span>
            </div>
            <div className={styles.scopeLabel}>
              A LITTLE TRUST. CLEAR BOUNDARIES.
            </div>
            <div className={styles.scopeRow}>
              <Box size={17} />
              <span>Rebond</span>
              <span>
                Read + write <ChevronDown size={12} />
              </span>
            </div>
            <div className={styles.scopeRow}>
              <Box size={17} />
              <span>OwlAgent</span>
              <span>
                Read only <ChevronDown size={12} />
              </span>
            </div>
            <div className={styles.scopeRow}>
              <LockKeyhole size={17} />
              <span>Everything else</span>
              <span>No access</span>
            </div>
            <div className={styles.agentAction}>
              <span>✳</span>
              <div>
                <strong>Claude edited Strategy.md</strong>
                <p>A new version. A clear trail. You’re in control.</p>
              </div>
              <Check size={15} />
            </div>
            <div className={styles.agentDemoFoot}>
              <LockKeyhole size={13} />
              Access is yours to give. And yours to take back.
            </div>
          </div>
        </section>
        <section className={styles.howSection} id="how-it-works">
          <div>
            <span className={styles.sectionLabel}>
              LESS SETUP. MORE POSSIBILITY.
            </span>
            <h2>
              From “what if”
              <br />
              to <em>“here it is.”</em>
            </h2>
          </div>
          <div className={styles.steps}>
            {[
              {
                title: "Make a little space.",
                text: "Create a project for your next launch, your client, or the idea you can’t stop thinking about.",
                icon: Folder,
              },
              {
                title: "Bring your people. And your agents.",
                text: "Give everyone the context and access they need. Keep the rest of your workspace private.",
                icon: Users,
              },
              {
                title: "Let the good work happen.",
                text: "Write, upload, comment, and refine. Every contribution stays connected to the person or agent behind it.",
                icon: MessageCircle,
              },
            ].map(({ title, text, icon: Icon }, i) => (
              <div key={title}>
                <span className={styles.stepIcon}>
                  <Icon size={19} />
                </span>
                <div>
                  <small>0{i + 1}</small>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className={styles.faq} aria-label="Questions about Spacie">
          <h2>
            A few things
            <br />
            you might be wondering.
          </h2>
          <div>
            {[
              {
                q: "Is Spacie another AI chatbot?",
                a: "Spacie is a shared workspace. Your documents, assets, conversations, and versions live together. Agents connect through MCP to work on those same files within the permissions you give them.",
              },
              {
                q: "Do agents have access to everything?",
                a: "You choose their projects and permissions. Full workspace access is an explicit option, never the default. You can rotate credentials or disconnect an agent when you need to.",
              },
              {
                q: "Can I try the workspace?",
                a: "Yes. Open Spacie to explore the working workspace. A locally configured demo uses sample content and saves changes on that computer. A cloud installation requires a connected backend and an account.",
              },
            ].map((item) => (
              <details key={item.q}>
                <summary>
                  {item.q}
                  <Plus size={17} />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className={styles.finalCta}>
          <Box size={38} strokeWidth={1.35} />
          <span className={styles.sectionLabel}>
            A LITTLE SPACE CAN CHANGE EVERYTHING.
          </span>
          <h2>
            Make room for
            <br />
            <em>what’s next.</em>
          </h2>
          <Link href={workspace} className={styles.primary}>
            Open your workspace <ArrowUpRight size={17} />
          </Link>
          <p>Your people. Your agents. Your next good idea.</p>
        </section>
      </main>
      <footer className={styles.footer}>
        <div>
          <Brand />
          <p>Good work has good company.</p>
        </div>
        <div>
          <a href="#product">The workspace</a>
          <a href="#teammates">AI teammates</a>
          <a href="https://github.com/Lorenzotrd/Spacie">
            GitHub <ArrowUpRight size={13} />
          </a>
        </div>
        <span>© {new Date().getFullYear()} Spacie</span>
      </footer>
    </div>
  );
}
