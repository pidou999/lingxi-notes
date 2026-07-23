package main

import (
	"fmt"
	"net"
	"net/url"
)

// isLoopbackOrLinkLocal reports whether ip is loopback (127/8, ::1), the
// cloud metadata address (169.254.169.254, which lives in link-local),
// or any link-local unicast/multicast address. RFC1918 (10/8, 172.16/12,
// 192.168/16) and IPv6 ULA (fd00::/8) are deliberately ALLOWED so that
// self-hosted LAN providers (e.g. an ollama on 192.168.x.x) keep working.
func isLoopbackOrLinkLocal(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
		return true
	}
	// IPv4 link-local 169.254.0.0/16 (covers cloud metadata 169.254.169.254)
	if v4 := ip.To4(); v4 != nil {
		if v4[0] == 169 && v4[1] == 254 {
			return true
		}
	}
	return false
}

// assertSafeURL validates that a user-supplied base URL does not point at a
// loopback / link-local / cloud-metadata address. Hostnames are resolved via
// DNS and rejected if ANY resolved address is loopback or link-local. A
// generic error is returned (no internal detail) so it is safe to surface to
// the caller. RFC1918 / ULA LAN addresses are permitted on purpose.
func assertSafeURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("invalid URL")
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("only http/https URLs are allowed")
	}
	host := u.Hostname()
	if host == "" {
		return fmt.Errorf("missing host")
	}
	if ip := net.ParseIP(host); ip != nil {
		if isLoopbackOrLinkLocal(ip) {
			return fmt.Errorf("blocked address")
		}
		return nil
	}
	ips, err := net.LookupIP(host)
	if err != nil {
		// Resolution failure: block to avoid DNS-rebinding / typo bypasses.
		return fmt.Errorf("cannot resolve host")
	}
	for _, ip := range ips {
		if isLoopbackOrLinkLocal(ip) {
			return fmt.Errorf("blocked address")
		}
	}
	return nil
}
