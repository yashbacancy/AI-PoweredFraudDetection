"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const sectionNav = [
  { id: "hero", label: "Home" },
  { id: "platform", label: "Platform" },
  { id: "workflow", label: "Workflow" },
  { id: "pricing", label: "Pricing" },
];

const headerMenu = [
  { label: "Product", href: "#platform", activeId: "platform" },
  { label: "Use Cases", href: "#workflow", activeId: "workflow" },
  { label: "Pricing", href: "#pricing", activeId: "pricing" },
];

const capabilities = [
  {
    title: "Real-time Risk Scoring",
    description: "Score every transaction in milliseconds using behavior, device, and payment context.",
  },
  {
    title: "Fraud Prevention Automation",
    description: "Trigger block, review, or step-up actions instantly with policy + model confidence.",
  },
  {
    title: "Analyst-ready Case Management",
    description: "Route high-risk events with evidence, timelines, and resolution workflows.",
  },
];

const workflowSteps = [
  {
    title: "Ingest",
    detail: "Collect payment, identity, and device signals with low-latency APIs.",
    tags: ["API", "Device", "Identity"],
    image: "/workflow-ingest.svg",
    imageAlt: "Signal ingestion from payment, identity, and device sources",
    metric: "~ 42 ms",
  },
  {
    title: "Score",
    detail: "Apply rules plus ML risk scoring to classify suspicious behavior in real time.",
    tags: ["Rules", "ML", "Risk"],
    image: "/workflow-score.svg",
    imageAlt: "Real-time model scoring and risk distribution analysis",
    metric: "0.93 risk",
  },
  {
    title: "Respond",
    detail: "Approve, challenge, block, or queue for analyst review based on confidence thresholds.",
    tags: ["Approve", "Review", "Block"],
    image: "/workflow-respond.svg",
    imageAlt: "Automated response routing to approve, review, or block",
    metric: "Policy route",
  },
  {
    title: "Learn",
    detail: "Use investigation outcomes and chargeback feedback to continuously improve detection.",
    tags: ["Feedback", "Chargebacks", "Retrain"],
    image: "/workflow-learn.svg",
    imageAlt: "Feedback loop improving models from analyst outcomes",
    metric: "Model update",
  },
];

const heroWords = ["Scored", "Protected", "Risk-Free"];

const signalChips = ["Risk score", "Device fingerprint", "Velocity checks", "Case alerts"];

const footerPrimaryLinks = ["Download", "Product", "Docs", "Changelog", "Press", "Releases"];
const footerSecondaryLinks = ["Blog", "Pricing", "Use Cases"];
const footerLegalLinks = ["About Aegis", "Aegis Products", "Privacy", "Terms"];
const monetizationStrategies = [
  {
    title: "Per-transaction pricing",
    description: "Usage-based model with built-in volume discounts as transaction throughput increases.",
    tag: "Usage",
  },
  {
    title: "SaaS subscription tiers",
    description: "Tiered plans based on monthly transaction volume and advanced feature access.",
    tag: "SaaS",
  },
  {
    title: "Enterprise licensing",
    description: "Custom commercial terms and implementation packages for high-scale operations.",
    tag: "Enterprise",
  },
  {
    title: "Consulting services",
    description: "Fraud strategy design, rollout support, and optimization from domain experts.",
    tag: "Advisory",
  },
  {
    title: "Data enrichment feeds",
    description: "Threat intelligence and enrichment services to improve risk decision quality.",
    tag: "Data",
  },
  {
    title: "White-label platform",
    description: "Brand-ready fraud detection platform licensing for partners and service providers.",
    tag: "OEM",
  },
];

export default function LandingPage() {
  const rootRef = useRef<HTMLElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [activeSection, setActiveSection] = useState("hero");
  const [activeStep, setActiveStep] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveStep((prev) => (prev + 1) % workflowSteps.length);
    }, 2000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const word = heroWords[wordIndex];
    let delay: number;

    if (!isDeleting && typedText.length < word.length) {
      delay = 80;
    } else if (!isDeleting && typedText.length === word.length) {
      delay = 1400;
    } else if (isDeleting && typedText.length > 0) {
      delay = 45;
    } else {
      delay = 200;
    }

    const timer = window.setTimeout(() => {
      if (!isDeleting && typedText.length < word.length) {
        setTypedText(word.slice(0, typedText.length + 1));
      } else if (!isDeleting && typedText.length === word.length) {
        setIsDeleting(true);
      } else if (isDeleting && typedText.length > 0) {
        setTypedText(word.slice(0, typedText.length - 1));
      } else {
        setIsDeleting(false);
        setWordIndex((prev) => (prev + 1) % heroWords.length);
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [typedText, isDeleting, wordIndex]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
      setProgress(Math.min(1, Math.max(0, ratio)));
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  useEffect(() => {
    const ids = sectionNav.map((item) => item.id);
    const nodes = ids
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => node !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
            entry.target.classList.add("is-inview");
          } else if (entry.boundingClientRect.top > 0 || window.scrollY > 20) {
            entry.target.classList.remove("is-inview");
          }
        });
      },
      {
        threshold: 0.35,
        rootMargin: "-18% 0px -28% 0px",
      },
    );

    nodes.forEach((node) => {
      if (node.id === "hero") node.classList.add("is-inview");
      observer.observe(node);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".aegis-slim__reveal"));
    if (nodes.length === 0) return;

    if (!("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.18 },
    );

    nodes.forEach((node) => {
      const { top } = node.getBoundingClientRect();
      if (top < window.innerHeight * 0.92) {
        node.classList.add("is-visible");
      }
      observer.observe(node);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let frame = 0;
    const move = (event: PointerEvent) => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = (event.clientX / window.innerWidth) * 100;
        const y = (event.clientY / window.innerHeight) * 100;
        root.style.setProperty("--mx", `${x}%`);
        root.style.setProperty("--my", `${y}%`);
      });
    };

    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const currentWorkflowStep = workflowSteps[activeStep];

  return (
    <main ref={rootRef} className="aegis-slim">
      <div className="aegis-slim__spotlight" aria-hidden />
      <div className="aegis-slim__progress" aria-hidden>
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>

      <header className="aegis-slim__header">
        <div className="aegis-slim__shell aegis-slim__header-inner">
          <div className="aegis-slim__header-left">
            <Link href="/" className="aegis-slim__brand" aria-label="Aegis Home">
              <span className="aegis-slim__brand-mark" aria-hidden />
              <span>Aegis</span>
            </Link>

            <nav className="aegis-slim__nav" aria-label="Primary">
              {headerMenu.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`aegis-slim__nav-link ${activeSection === item.activeId ? "is-active" : ""}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <Link href="/signup" className="aegis-slim__header-cta">
            Let&apos;s Start
          </Link>
        </div>
      </header>

      <section id="hero" className="aegis-slim__section aegis-slim__hero">
        <div className="aegis-slim__shell">
          <div className="aegis-slim__orbit" aria-hidden />
          <p className="aegis-slim__kicker aegis-slim__reveal">
            AI-Powered Fraud Detection & Prevention Platform
          </p>
          <h1 className="aegis-slim__title aegis-slim__reveal delay-1">
            <span style={{ display: "block", whiteSpace: "nowrap" }}>Make Your Transaction</span>
            <span className="aegis-slim__hero-word">
              {typedText}
              <span className="aegis-slim__cursor" aria-hidden />
            </span>
          </h1>
          <p className="aegis-slim__subtitle aegis-slim__reveal delay-2">
            Aegis helps fintech teams detect risky behavior, prevent fraudulent payments, and investigate incidents
            fast without adding unnecessary customer friction.
          </p>
          <div className="aegis-slim__actions aegis-slim__reveal delay-3">
            <Link href="/signup" className="aegis-slim__btn aegis-slim__btn--dark">
              Start now
            </Link>
            <Link href="#platform" className="aegis-slim__btn aegis-slim__btn--light">
              Explore platform
            </Link>
          </div>
          <div className="aegis-slim__chip-row aegis-slim__reveal delay-4" aria-label="Platform Signals">
            {signalChips.map((chip) => (
              <span key={chip} className="aegis-slim__chip">
                {chip}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="platform" className="aegis-slim__section">
        <div className="aegis-slim__shell">
          <div className="aegis-slim__section-head aegis-slim__reveal">
            <p>Platform</p>
            <h2>Minimal interface. Maximum fraud coverage.</h2>
          </div>
          <div className="aegis-slim__card-grid">
            {capabilities.map((capability, index) => (
              <article
                key={capability.title}
                className={`aegis-slim__card aegis-slim__reveal ${index === 0 ? "delay-1" : index === 1 ? "delay-2" : "delay-3"}`}
              >
                <h3>{capability.title}</h3>
                <p>{capability.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="aegis-slim__section">
        <div className="aegis-slim__shell aegis-slim__workflow">
          <div className="aegis-slim__workflow-copy aegis-slim__reveal">
            <p>Workflow</p>
            <h2>Interactive risk pipeline</h2>
            <p>
              Hover each step to preview how Aegis processes transactions from signal ingestion to prevention and
              learning.
            </p>
            <div className="aegis-slim__steps">
              {workflowSteps.map((step, index) => (
                <button
                  key={step.title}
                  type="button"
                  onClick={() => setActiveStep(index)}
                  onMouseEnter={() => setActiveStep(index)}
                  onFocus={() => setActiveStep(index)}
                  className={`aegis-slim__step ${activeStep === index ? "is-active" : ""}`}
                >
                  <span>{index + 1}</span>
                  <span>{step.title}</span>
                </button>
              ))}
            </div>
          </div>

          <article className="aegis-slim__preview aegis-slim__reveal delay-1" aria-live="polite">
            <p className="aegis-slim__preview-label">Live Preview</p>
            <div key={activeStep} className="aegis-slim__preview-stage">
              <h3>{currentWorkflowStep.title}</h3>
              <p>{currentWorkflowStep.detail}</p>
              <div className="aegis-slim__tag-row">
                {currentWorkflowStep.tags.map((tag) => (
                  <span key={`${currentWorkflowStep.title}-${tag}`}>{tag}</span>
                ))}
              </div>
              <div className={`aegis-slim__video-panel step-${activeStep}`}>
                <div className="aegis-slim__video-frame">
                  <Image
                    src={currentWorkflowStep.image}
                    alt={currentWorkflowStep.imageAlt}
                    width={1200}
                    height={320}
                    className="aegis-slim__video-image"
                    sizes="(max-width: 1020px) 100vw, 50vw"
                    priority={activeStep === 0}
                  />
                  <div className="aegis-slim__video-glow" />
                  <div className="aegis-slim__video-scanline" />
                </div>
                <div className="aegis-slim__video-footer">
                  <small>Live signal stream</small>
                  <small>{currentWorkflowStep.metric}</small>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section id="pricing" className="aegis-slim__section">
        <div className="aegis-slim__shell">
          <article className="aegis-slim__pricing aegis-slim__reveal">
            <p>Pricing</p>
            <h2>Simple pricing. Powerful protection.</h2>
            <p>Flexible pricing and licensing options for fintech teams, platforms, and enterprise deployments.</p>
            <div className="aegis-slim__pricing-grid">
              {monetizationStrategies.map((item) => (
                <article key={item.title} className="aegis-slim__pricing-card">
                  <span className="aegis-slim__pricing-tag">{item.tag}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
            <div className="aegis-slim__pricing-actions">
              <Link href="/signup" className="aegis-slim__btn aegis-slim__btn--dark">
                Talk to sales
              </Link>
              <Link href="#resources" className="aegis-slim__btn aegis-slim__btn--light">
                View docs
              </Link>
            </div>
          </article>
        </div>

        <footer id="resources" className="aegis-slim__footer aegis-slim__reveal delay-1">
          <div className="aegis-slim__shell aegis-slim__footer-inner">
            <div className="aegis-slim__footer-top">
              <p className="aegis-slim__footer-headline">Experience liftoff</p>
              <div className="aegis-slim__footer-links-wrap">
                <div className="aegis-slim__footer-links-col">
                  {footerPrimaryLinks.map((item) => (
                    <a key={item} href="#">
                      {item}
                    </a>
                  ))}
                </div>
                <div className="aegis-slim__footer-links-col">
                  {footerSecondaryLinks.map((item) => (
                    <a key={item} href="#">
                      {item}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <p className="aegis-slim__footer-wordmark">Aegis</p>

            <div className="aegis-slim__footer-bottom">
              <p className="aegis-slim__footer-brand">Aegis</p>
              <div className="aegis-slim__footer-legal">
                {footerLegalLinks.map((item) => (
                  <a key={item} href="#">
                    {item}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </footer>
      </section>
    </main>
  );
}
