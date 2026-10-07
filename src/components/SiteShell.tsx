"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, createContext, useContext } from "react";
import { ArrowUpRight, ArrowRight, Menu, X, Phone, MapPin } from "lucide-react";
import { navigation, restaurant } from "@/lib/content";

const BookingContext = createContext<(topic?: string) => void>(() => {});

export function BookingButton({ children = "Book a table", className = "button", topic }: { children?: React.ReactNode; className?: string; topic?: string }) {
  const open = useContext(BookingContext);
  return <button className={className} onClick={() => open(topic)}>{children}<ArrowUpRight size={17} aria-hidden="true" /></button>;
}

export function SiteShell({ children, menuPage = false }: { children: React.ReactNode; menuPage?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [topic, setTopic] = useState("A table for you.");
  const dialog = useRef<HTMLDialogElement>(null);
  const mobileButton = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);

  useEffect(() => {
    const update = () => { setScrolled(window.scrollY > 24); if (window.scrollY < 200) setActiveSection(""); };
    update();
    window.addEventListener("scroll", update, { passive: true });
    const desktop = window.matchMedia("(min-width: 801px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => { if (event.matches) setMobileOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => { window.removeEventListener("scroll", update); desktop.removeEventListener("change", closeOnDesktop); };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setMobileOpen(false); mobileButton.current?.focus(); } };
    const outside = (event: PointerEvent) => { if (!header.current?.contains(event.target as Node)) setMobileOpen(false); };
    const focusOutside = (event: FocusEvent) => { if (!header.current?.contains(event.target as Node)) setMobileOpen(false); };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", focusOutside);
    return () => { document.removeEventListener("keydown", close); document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", focusOutside); };
  }, [mobileOpen]);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const elements = document.querySelectorAll<HTMLElement>(".reveal");
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); } }), { threshold: 0.08 });
    elements.forEach(el => {
      if (!motion.matches && el.getBoundingClientRect().top >= window.innerHeight) el.classList.add("reveal-ready");
      else el.classList.add("is-visible");
      observer.observe(el);
    });
    const showAll = () => { if (motion.matches) elements.forEach(el => el.classList.add("is-visible")); };
    motion.addEventListener("change", showAll);
    const sections = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) setActiveSection(entry.target.id); }), { rootMargin: "-15% 0px -55% 0px", threshold: 0 });
    document.querySelectorAll("#story, #experiences, #visit").forEach(el => sections.observe(el));
    return () => { observer.disconnect(); sections.disconnect(); motion.removeEventListener("change", showAll); elements.forEach(el => el.classList.remove("reveal-ready")); };
  }, []);

  const openBooking = (value = "A table for you.") => { setTopic(value); setMobileOpen(false); dialog.current?.showModal(); };
  return <BookingContext.Provider value={openBooking}>
    <div className="announcement"><span>SOUTH INDIAN ROOTS. ADELAIDE SOUL.</span><a href={restaurant.phoneHref}>A warm welcome awaits <ArrowUpRight size={12} /></a></div>
    <header ref={header} className={`site-header${scrolled ? " is-scrolled" : ""}`}>
      <Link className="brand" href="/" aria-label="Chennai Palace home"><Image src="/images/logo.webp" alt="Chennai Palace" width={110} height={73} priority /><span>CHENNAI PALACE<small>SOUTH INDIAN KITCHEN · ADELAIDE</small></span></Link>
      <nav aria-label="Main navigation" className="desktop-nav">{navigation.map(link => { const current = menuPage ? link.href === "/menu" : link.href === `/#${activeSection}`; return <Link key={link.href} className={current ? "current" : ""} aria-current={current ? (menuPage ? "page" : "location") : undefined} href={link.href}>{link.label}</Link>; })}</nav>
      <BookingButton className="button header-booking" />
      <button ref={mobileButton} className="mobile-toggle" aria-expanded={mobileOpen} aria-controls="mobile-navigation" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X /> : <Menu />}</button>
      {mobileOpen && <nav className="mobile-nav" id="mobile-navigation" aria-label="Mobile navigation">{navigation.map((link,i) => <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}><span>0{i+1}</span>{link.label}<ArrowUpRight /></Link>)}<BookingButton /><a className="mobile-phone" href={restaurant.phoneHref}>{restaurant.phone}</a></nav>}
    </header>
    {children}
    <footer className="footer">
      <div className="footer-top"><div><span className="eyebrow">YOUR NEXT GOOD MEAL STARTS HERE</span><h2>Come hungry.<br /><em>Leave happy.</em></h2></div><BookingButton className="circle-link" topic="Let’s get you a table.">Let’s make<br />a plan</BookingButton></div>
      <div className="footer-grid"><Link className="footer-logo" href="/"><Image src="/images/logo.webp" alt="Chennai Palace" width={145} height={96} /><span>Chennai roots.<br />Adelaide table.</span></Link><div><h3>Find your way</h3>{navigation.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}</div><div><h3>Come on over</h3><a href={restaurant.maps} target="_blank" rel="noopener noreferrer">{restaurant.address}<br />{restaurant.locality}<ArrowUpRight size={15} /></a><a href={restaurant.phoneHref}>{restaurant.phone}</a></div><div><h3>Make it an occasion</h3><button onClick={() => openBooking("Bring your people.")}>Group dining <ArrowUpRight size={14} /></button><button onClick={() => openBooking("Something to celebrate?")}>Functions & catering <ArrowUpRight size={14} /></button><a href={restaurant.phoneHref}>Takeaway orders <ArrowUpRight size={14} /></a></div></div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Chennai Palace. All rights reserved.</span><span>Made for good food & good company.</span><a href="#top">Back to top ↑</a></div>
    </footer>
    <div className="mobile-bottom"><a href={restaurant.phoneHref}><Phone size={16} /> Call us</a><BookingButton className="button" /></div>
    <dialog ref={dialog} className="booking-dialog" aria-label={topic} onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
      <div className="dialog-inner"><button className="dialog-close" onClick={() => dialog.current?.close()} aria-label="Close booking dialog"><X /></button><Image src="/images/logo.webp" alt="Chennai Palace" width={95} height={63} /><span className="eyebrow">WE’D LOVE TO WELCOME YOU</span><h2>{topic}</h2><p>For table bookings, group dining or a celebration, give our team a call. We’ll help you plan your visit.</p><a className="button" href={restaurant.phoneHref}><Phone size={17} />{restaurant.phone}<ArrowUpRight size={17} /></a><p className="dialog-address"><MapPin size={16} />{restaurant.address}, {restaurant.locality}</p><Link className="text-link" href="/menu" onClick={() => dialog.current?.close()}>Explore the menu first <ArrowRight size={17} /></Link></div>
    </dialog>
  </BookingContext.Provider>;
}
