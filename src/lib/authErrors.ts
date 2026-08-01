/**
 * Turns an auth error into something a user can act on.
 *
 * The fallback used to return the raw message, which meant a network failure
 * put the browser's own "Failed to fetch" in front of someone trying to sign
 * in - English, technical, and no hint that the problem is connectivity
 * rather than their password.
 */
export const translateAuthError = (message: string): string => {
  const lower = message.toLowerCase();

  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("load failed") ||
    lower.includes("err_") ||
    lower.includes("timeout")
  ) {
    return "Vi kunde inte nå servern. Kontrollera din internetanslutning och försök igen.";
  }

  if (message.includes("Invalid login credentials")) {
    return "Fel e-postadress eller lösenord.";
  }
  if (message.includes("User already registered")) {
    return "Det finns redan ett konto med den e-postadressen. Logga in istället.";
  }
  if (message.includes("Password should be at least")) {
    return "Lösenordet måste vara minst 6 tecken.";
  }
  if (message.includes("Unable to validate email address")) {
    return "Ogiltig e-postadress.";
  }
  if (lower.includes("email not confirmed")) {
    return "E-postadressen är inte bekräftad än. Leta efter bekräftelsemejlet i din inkorg.";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "För många försök. Vänta en stund innan du försöker igen.";
  }

  // Anything unrecognised: say what we know rather than nothing, but do not
  // pretend the raw text is a Swedish explanation.
  return `Något gick fel vid inloggningen. Försök igen. (${message})`;
};
