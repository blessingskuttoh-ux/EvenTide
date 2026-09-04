const form = document.getElementById("bookingForm");
const status = document.getElementById("formStatus");
const vendorLoginForm = document.getElementById("vendorLoginForm");
const vendorLoginStatus = document.getElementById("vendorLoginStatus");
const vendorApplyForm = document.getElementById("vendorApplyForm");
const vendorApplyStatus = document.getElementById("vendorApplyStatus");

if (form && status) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const name = data.get("name")?.toString().trim() || "there";
    const budget =
      data.get("budget")?.toString().trim() || "your preferred budget";
    const date = data.get("date")?.toString().trim() || "your preferred date";
    const time = data.get("time")?.toString().trim() || "your preferred time";
    const venue =
      data.get("venue")?.toString().trim() || "your preferred venue";
    const guests =
      data.get("guests")?.toString().trim() || "the expected guest count";

    status.textContent = `Thanks, ${name}! We’ll be in touch shortly with the best options for your event. Budget: ${budget}, Date: ${date}, Time: ${time}, Venue: ${venue}, Guests: ${guests}.`;
    form.reset();
  });
}

if (vendorLoginForm && vendorLoginStatus) {
  vendorLoginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    vendorLoginStatus.textContent =
      "Login request received. Our team will verify your account shortly.";
    vendorLoginForm.reset();
  });
}

if (vendorApplyForm && vendorApplyStatus) {
  vendorApplyForm.addEventListener("submit", (event) => {
    event.preventDefault();
    vendorApplyStatus.textContent =
      "Application submitted successfully. We will review your profile and contact you soon.";
    vendorApplyForm.reset();
  });
}
