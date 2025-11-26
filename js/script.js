document.addEventListener("DOMContentLoaded", function(){
  // TELEFONE - BANDEIRINHA E MÁSCARA
  const phoneInput = document.querySelector('input[name="phone"]');
  let itiInstance = null;
  if (phoneInput) {
    const iti = window.intlTelInput(phoneInput, {
      initialCountry: "us",
      preferredCountries: ["us", "br"],
      nationalMode: false,
      separateDialCode: true,
      formatOnDisplay: true,
      utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js"
    });
    itiInstance = iti;

    function applyPhoneMask() {
      var country = iti.getSelectedCountryData().iso2;
      $(phoneInput).unmask();
      if (country === "us") {
        $(phoneInput).mask('(000) 000-0000');
      } else if (country === "br") {
        $(phoneInput).mask('00 00000-0000');
      } else {
        $(phoneInput).unmask();
      }
    }
    applyPhoneMask();
    phoneInput.addEventListener("countrychange", applyPhoneMask);
  }

  // FORM MULTISTEP
  let currentStep = 1;
  let driverCount = 0;
  let vehicleCount = 0;

  window.nextStep = function() {
    if (!validateStep()) return;
    const current = document.querySelector(`.form-step[data-step="${currentStep}"]`);
    const next = document.querySelector(`.form-step[data-step="${currentStep + 1}"]`);
    if (current && next) {
      current.classList.remove("active");
      next.classList.add("active");
      currentStep++;
    }
  }
  window.prevStep = function() {
    const current = document.querySelector(`.form-step[data-step="${currentStep}"]`);
    const prev = document.querySelector(`.form-step[data-step="${currentStep - 1}"]`);
    if (current && prev) {
      current.classList.remove("active");
      prev.classList.add("active");
      currentStep--;
    }
  }

  // ========== VIN VALIDATION ==========
  function isValidVIN(vin) {
    vin = vin.toUpperCase();
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return false;
    const map = {
      A:1, B:2, C:3, D:4, E:5, F:6, G:7, H:8,
      J:1, K:2, L:3, M:4, N:5, P:7, R:9, S:2,
      T:3, U:4, V:5, W:6, X:7, Y:8, Z:9,
      '1':1, '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, '0':0
    };
    const weights = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];
    let sum = 0;
    for (let i = 0; i < 17; i++) { sum += map[vin.charAt(i)] * weights[i]; }
    let checkDigit = sum % 11;
    checkDigit = (checkDigit === 10) ? 'X' : checkDigit.toString();
    return vin.charAt(8) === checkDigit;
  }

  function validateAllVINs() {
    let allOk = true;
    const vinMode = (document.querySelector('input[name="vin_option"]:checked') || {}).value;

    const mainVINInput = document.getElementById('vehicle_main');
    const mainVINError = document.getElementById('vin-error');
    if (vinMode === 'sim' && mainVINInput) {
      if (mainVINInput.value.trim() === "") {
        if (mainVINError) { mainVINError.textContent = "Informe o VIN do veículo."; mainVINError.style.display = "block"; }
        mainVINInput.focus();
        allOk = false;
      } else if (!isValidVIN(mainVINInput.value.trim())) {
        if (mainVINError) { mainVINError.textContent = "O VIN informado não é válido. Confira os 17 caracteres no documento do veículo."; mainVINError.style.display = "block"; }
        mainVINInput.focus();
        allOk = false;
      } else {
        if (mainVINError) mainVINError.style.display = "none";
      }
    } else {
      if (mainVINError) mainVINError.style.display = "none";
    }

    // VINs adicionais (se preencher, valida)
    document.querySelectorAll('input[name="additional_vehicle_vin[]"]').forEach(function(input){
      const errorSpan = input.parentNode.querySelector('.vin-error');
      if (input.value.trim() !== "") {
        if (!isValidVIN(input.value.trim())) {
          if (errorSpan) {
            errorSpan.textContent = "O VIN informado não é válido. Confira os 17 caracteres no documento do veículo.";
            errorSpan.style.display = "block";
          }
          input.focus();
          allOk = false;
        } else {
          if (errorSpan) errorSpan.style.display = "none";
        }
      } else {
        if (errorSpan) errorSpan.style.display = "none";
      }
    });
    return allOk;
  }

  // ========== ELEMENTOS VIN x MODELO ==========
  const vinSection = document.getElementById('vin-section');
  const modelSection = document.getElementById('model-section');
  const mainVINInput = document.getElementById('vehicle_main');

  const yearSelect = document.getElementById("yearSelect");
  const makeSelect = document.getElementById("makeSelect");
  const modelSelect = document.getElementById("modelSelect");
  const modelMsg = document.getElementById("model-msg");

  function setVehicleMode(mode) {
    if (mode === 'sim') {
      // Modo VIN
      vinSection.style.display = 'block';
      modelSection.style.display = 'none';
      if (mainVINInput) mainVINInput.setAttribute('required', 'required');
      yearSelect.removeAttribute('required');
      makeSelect.removeAttribute('required');
      modelSelect.removeAttribute('required');
    } else if (mode === 'nao') {
      // Modo Modelo (somente selects via API)
      vinSection.style.display = 'none';
      modelSection.style.display = 'block';
      if (mainVINInput) mainVINInput.removeAttribute('required');
      yearSelect.setAttribute('required', 'required');
      makeSelect.setAttribute('required', 'required');
      modelSelect.setAttribute('required', 'required');
    }
  }

  document.querySelectorAll('input[name="vin_option"]').forEach(radio => {
    radio.addEventListener('change', function() {
      setVehicleMode(this.value);
    });
  });

  // ========== Preencher anos ==========
  if (yearSelect) {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= 1980; y--) {
      const opt = document.createElement("option");
      opt.value = y; opt.textContent = y;
      yearSelect.appendChild(opt);
    }
  }

  // ========== CACHE (localStorage) ==========
  const MAKES_KEY = 'nhtsa_makes_v1';
  function loadMakesCache(maxAgeMs, allowExpired=false) {
    try {
      const raw = localStorage.getItem(MAKES_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || !Array.isArray(obj.items)) return null;
      const age = Date.now() - (obj.ts || 0);
      if (age <= maxAgeMs || allowExpired) return obj.items;
      return null;
    } catch { return null; }
  }
  function saveMakesCache(items) {
    try {
      localStorage.setItem(MAKES_KEY, JSON.stringify({ ts: Date.now(), items }));
    } catch {}
  }

  function modelsKey(make, year) { return `nhtsa_models_v1_${make}|${year}`; }
  function loadModelsCache(make, year, maxAgeMs, allowExpired=false) {
    try {
      const raw = localStorage.getItem(modelsKey(make, year));
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || !Array.isArray(obj.items)) return null;
      const age = Date.now() - (obj.ts || 0);
      if (age <= maxAgeMs || allowExpired) return obj.items;
      return null;
    } catch { return null; }
  }
  function saveModelsCache(make, year, items) {
    try {
      localStorage.setItem(modelsKey(make, year), JSON.stringify({ ts: Date.now(), items }));
    } catch {}
  }

  const MAX_AGE = 1000 * 60 * 60 * 48; // 48h

  function clearSelect(sel, placeholder) {
    sel.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = ""; opt.textContent = placeholder;
    sel.appendChild(opt);
  }
  function setLoading(sel, isLoading, loadingText="Carregando...") {
    sel.disabled = !!isLoading;
    if (isLoading) clearSelect(sel, loadingText);
  }

  // ========== NHTSA: carregar marcas ==========
  yearSelect.addEventListener("change", async function(){
    clearSelect(makeSelect, "Selecione a marca");
    clearSelect(modelSelect, "Selecione o modelo");
    modelMsg.style.display = "none";

    if (!this.value) {
      makeSelect.disabled = true;
      modelSelect.disabled = true;
      return;
    }

    const cached = loadMakesCache(MAX_AGE);
    if (cached && cached.length) {
      populateMakes(cached);
      return;
    }

    try {
      setLoading(makeSelect, true);
      const resp = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/car?format=json`);
      const data = await resp.json();
      const names = Array.from(new Set((data.Results || []).map(m => (m.MakeName || "").trim()).filter(Boolean)))
        .sort((a,b)=>a.localeCompare(b));
      saveMakesCache(names);
      populateMakes(names);
    } catch (e) {
      const expired = loadMakesCache(MAX_AGE, true);
      if (expired && expired.length) {
        populateMakes(expired);
        modelMsg.textContent = "Não foi possível contatar a API agora. Usamos marcas em cache (pode estar desatualizado).";
        modelMsg.style.display = "block";
      } else {
        modelMsg.textContent = "Não foi possível carregar as marcas. Tente novamente mais tarde ou opte por informar o VIN.";
        modelMsg.style.display = "block";
        makeSelect.disabled = true;
        modelSelect.disabled = true;
      }
    }
  });

  function populateMakes(names) {
    clearSelect(makeSelect, "Selecione a marca");
    names.forEach(name => {
      const opt = document.createElement("option");
      opt.value = name; opt.textContent = name;
      makeSelect.appendChild(opt);
    });
    makeSelect.disabled = false;
    modelSelect.disabled = true;
  }

  // ========== NHTSA: carregar modelos ==========
  makeSelect.addEventListener("change", async function(){
    clearSelect(modelSelect, "Selecione o modelo");
    modelMsg.style.display = "none";
    if (!this.value || !yearSelect.value) {
      modelSelect.disabled = true;
      return;
    }

    const make = this.value.trim();
    const year = yearSelect.value.trim();

    const cached = loadModelsCache(make, year, MAX_AGE);
    if (cached && cached.length) {
      populateModels(cached);
      return;
    }

    try {
      setLoading(modelSelect, true);
      const resp = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${encodeURIComponent(year)}?format=json`);
      const data = await resp.json();
      const models = Array.from(new Set((data.Results || []).map(m => (m.Model_Name || "").trim()).filter(Boolean)))
        .sort((a,b)=>a.localeCompare(b));
      saveModelsCache(make, year, models);
      populateModels(models);
    } catch (e) {
      const expired = loadModelsCache(make, year, MAX_AGE, true);
      if (expired && expired.length) {
        populateModels(expired);
        modelMsg.textContent = "Não foi possível contatar a API agora. Usamos modelos em cache (pode estar desatualizado).";
        modelMsg.style.display = "block";
      } else {
        modelMsg.textContent = "Não foi possível carregar os modelos. Tente novamente mais tarde ou opte por informar o VIN.";
        modelMsg.style.display = "block";
        modelSelect.disabled = true;
      }
    }
  });

  function populateModels(models) {
    clearSelect(modelSelect, "Selecione o modelo");
    models.forEach(name => {
      const opt = document.createElement("option");
      opt.value = name; opt.textContent = name;
      modelSelect.appendChild(opt);
    });
    modelSelect.disabled = false;
  }

  // VALIDAR CAMPOS OBRIGATÓRIOS (base + VIN/Modelo)
  function validateStep() {
    document.querySelectorAll(".form-error").forEach(el => el.remove());
    const current = document.querySelector(`.form-step[data-step="${currentStep}"]`);
    const inputs = current.querySelectorAll("input[required], select[required], textarea[required]");
    for (let input of inputs) {
      if (input.type === "radio") {
        const radios = current.querySelectorAll(`input[type="radio"][name="${input.name}"]`);
        const oneChecked = Array.from(radios).some(r => r.checked);
        if (!oneChecked) {
          let lastRadio = radios[radios.length - 1];
          if (!lastRadio.nextElementSibling || !lastRadio.nextElementSibling.classList.contains('form-error')) {
            let error = document.createElement("div");
            error.className = "form-error";
            error.style.color = "#E53935";
            error.style.fontSize = "0.97em";
            error.style.marginTop = "2px";
            error.innerText = "Por favor, selecione uma opção.";
            lastRadio.parentNode.appendChild(error);
          }
          radios[0].focus();
          return false;
        }
      } else {
        const value = input.value.trim();

        if (!value) {
          if (!input.nextElementSibling || !input.nextElementSibling.classList.contains('form-error')) {
            let error = document.createElement("div");
            error.className = "form-error";
            error.style.color = "#E53935";
            error.style.fontSize = "0.97em";
            error.style.marginTop = "2px";
            error.innerText = "Por favor, preencha este campo.";
            input.parentNode.appendChild(error);
          }
          input.focus();
          return false;
        }

        // NOVO: obrigar nome + sobrenome no motorista principal
        if (input.name === "main_driver_name") {
          const parts = value.split(/\s+/);
          if (parts.length < 2) {
            let error = input.parentNode.querySelector('.form-error');
            if (!error) {
              error = document.createElement("div");
              error.className = "form-error";
              error.style.color = "#E53935";
              error.style.fontSize = "0.97em";
              error.style.marginTop = "2px";
              input.parentNode.appendChild(error);
            }
            error.innerText = "Você deve colocar seu nome e sobrenome.";
            input.focus();
            return false;
          }
        }
      }
    }

    // Regras específicas do Step 3
    const vehiclesStep = document.querySelector('.form-step[data-step="3"]');
    if (vehiclesStep && vehiclesStep.classList.contains('active')) {
      const vinMode = (document.querySelector('input[name="vin_option"]:checked') || {}).value;
      if (vinMode === 'sim') {
        if (!validateAllVINs()) return false;
      } else if (vinMode === 'nao') {
        const yearOk = !!yearSelect.value;
        const makeOk = !!makeSelect.value;
        const modelOk = !!modelSelect.value;
        if (!(yearOk && makeOk && modelOk)) {
          const error = document.createElement("div");
          error.className = "form-error";
          error.style.color = "#E53935";
          error.style.fontSize = "0.97em";
          error.style.marginTop = "2px";
          error.innerText = "Selecione Ano, Marca e Modelo (itens vindos da API).";
          modelSection.appendChild(error);
          return false;
        }
      }
    }

    return true;
  }

  // Remove mensagem de erro ao digitar
  document.querySelectorAll("input[required], select[required], textarea[required]").forEach(function(input) {
    input.addEventListener("input", function() {
      if (input.nextElementSibling && input.nextElementSibling.classList.contains('form-error')) {
        input.nextElementSibling.remove();
      }
    });
    if (input.type === "radio") {
      input.addEventListener("change", function() {
        let radios = document.querySelectorAll(`input[type="radio"][name="${input.name}"]`);
        radios.forEach(r => {
          if (r.parentNode.querySelector('.form-error')) {
            r.parentNode.querySelector('.form-error').remove();
          }
        });
      });
    }
  });

  // Limpa erro VIN ao digitar
  document.body.addEventListener("input", function(e){
    if (e.target && (e.target.name === "vehicle_main" || e.target.name === "additional_vehicle_vin[]")) {
      const errorSpan = e.target.parentNode.querySelector('.vin-error') || document.getElementById('vin-error');
      if (errorSpan) errorSpan.style.display = "none";
    }
  }, true);

  // MOTORISTAS ADICIONAIS
  window.addAdditionalDriver = function() {
    if (driverCount >= 2) return;
    const box = document.getElementById("additionalDrivers");
    const names = Array.from(box.querySelectorAll("input[name='additional_driver_name[]']")).map(el => el.value);
    const dobs = Array.from(box.querySelectorAll("input[name='additional_driver_dob[]']")).map(el => el.value);
    const licenses = [];
    for (let i = 1; i <= names.length; i++) {
      const checked = box.querySelector(`input[name='additional_driver_license_${i}']:checked`);
      licenses.push(checked ? checked.value : "");
    }
    names.push(""); dobs.push(""); licenses.push("");
    renderAdditionalDrivers(names, dobs, licenses);
  }
  window.removeAdditionalDriver = function(index) {
    const box = document.getElementById("additionalDrivers");
    let names = Array.from(box.querySelectorAll("input[name='additional_driver_name[]']")).map(el => el.value);
    let dobs = Array.from(box.querySelectorAll("input[name='additional_driver_dob[]']")).map(el => el.value);
    let licenses = [];
    for (let i = 1; i <= names.length; i++) {
      const checked = box.querySelector(`input[name='additional_driver_license_${i}']:checked`);
      licenses.push(checked ? checked.value : "");
    }
    names.splice(index, 1); dobs.splice(index, 1); licenses.splice(index, 1);
    renderAdditionalDrivers(names, dobs, licenses);
  }
  function renderAdditionalDrivers(names, dobs, licenses) {
    const box = document.getElementById("additionalDrivers");
    box.innerHTML = "";
    for (let i = 0; i < names.length && i < 2; i++) {
      box.innerHTML += `
        <div class='form-group additional-driver-group'>
          <div class="additional-driver-block">
            <label>Nome motorista adicional</label>
            <input type='text' name='additional_driver_name[]' value="${names[i] || ""}">
            <label>Data de nascimento</label>
            <input type='date' name='additional_driver_dob[]' value="${dobs[i] || ""}">
            <label>Possui carteira de motorista americana (Driver's License)?</label>
            <div class="checkbox-group">
              <label><input type='radio' name='additional_driver_license_${i+1}' value='sim' ${licenses[i]==='sim'?"checked":""} required> Sim</label>
              <label><input type='radio' name='additional_driver_license_${i+1}' value='nao' ${licenses[i]==='nao'?"checked":""} required> Não</label>
            </div>
          </div>
          <div class="remove-driver-area">
            <button type="button" onclick="removeAdditionalDriver(${i})" class="remove-adicional-btn" aria-label="Remover motorista adicional">
              <span>Remover adicional</span> <span class="x-ico">x</span>
            </button>
          </div>
        </div>
      `;
    }
    driverCount = names.length;
  }

  // VEÍCULOS ADICIONAIS
  window.addAdditionalVehicle = function() {
    if (vehicleCount >= 2) return;
    const box = document.getElementById("additionalVehicles");
    const vins = Array.from(box.querySelectorAll("input[name='additional_vehicle_vin[]']")).map(el => el.value);
    vins.push("");
    renderAdditionalVehicles(vins);
  }
  window.removeAdditionalVehicle = function(index) {
    const box = document.getElementById("additionalVehicles");
    let vins = Array.from(box.querySelectorAll("input[name='additional_vehicle_vin[]']")).map(el => el.value);
    vins.splice(index, 1);
    renderAdditionalVehicles(vins);
  }
  function renderAdditionalVehicles(vins) {
    const box = document.getElementById("additionalVehicles");
    box.innerHTML = "";
    for (let i = 0; i < vins.length && i < 2; i++) {
      box.innerHTML += `
        <div class='form-group additional-vehicle-group'>
          <div class="additional-vehicle-block">
            <label>VIN do veículo adicional</label>
            <input type='text' name='additional_vehicle_vin[]' value="${vins[i] || ""}" maxlength="17" autocomplete="off">
            <span class="vin-error" style="display:none;color:#E53935;font-size:0.97em;margin-top:2px;"></span>
          </div>
          <div class="remove-vehicle-area">
            <button type="button" onclick="removeAdditionalVehicle(${i})" class="remove-adicional-btn" aria-label="Remover veículo adicional">
              <span>Remover adicional</span> <span class="x-ico">x</span>
            </button>
          </div>
        </div>
      `;
    }
    vehicleCount = vins.length;
  }

  // EXIBIÇÃO DO RESUMO (VIN/Modelo)
  window.showSummary = function() {
    if (!validateStep()) return;
    const summary = document.getElementById("summaryBox");
    const form = document.getElementById("autoForm");
    const formData = new FormData(form);
    let text = "";
    text += `<strong>Estado:</strong> ${formData.get("state") || ""}<br>`;
    text += `<strong>Nome do motorista principal:</strong> ${formData.get("main_driver_name") || ""}<br>`;
    text += `<strong>Data de nascimento:</strong> ${formData.get("main_driver_dob") || ""}<br>`;
    text += `<strong>ZIP Code:</strong> ${formData.get("zip") || ""}<br>`;
    text += `<strong>Endereço completo:</strong> ${formData.get("address") || ""}<br>`;
    text += `<strong>Telefone:</strong> ${formData.get("phone") || ""}<br>`;
    text += `<strong>Possui (Driver's License): </strong> ${formData.get("has_license") || ""}<br>`;

    const additionalNames = formData.getAll("additional_driver_name[]");
    const additionalDOBs = formData.getAll("additional_driver_dob[]");
    let additionalLicenses = [];
    for (let i = 1; i <= additionalNames.length; i++) {
      additionalLicenses.push(formData.get(`additional_driver_license_${i}`));
    }
    let motoristasAdicionais = [];
    for (let i = 0; i < additionalNames.length; i++) {
      let info = [];
      if (additionalNames[i]) info.push(additionalNames[i]);
      if (additionalDOBs[i]) info.push(additionalDOBs[i]);
      if (additionalLicenses[i]) info.push(additionalLicenses[i]);
      if (info.length) motoristasAdicionais.push(info.join(", "));
    }
    if (motoristasAdicionais.length > 0) {
      text += `<strong>Motoristas adicionais:</strong> ${motoristasAdicionais.join(" | ")}<br>`;
    }

    const vinMode = formData.get("vin_option");
    if (vinMode === "sim") {
      text += `<strong>Veículo principal (VIN):</strong> ${formData.get("vehicle_main") || ""}<br>`;
    } else {
      const y = formData.get("vehicle_year") || "";
      const mk = formData.get("vehicle_make") || "";
      const md = formData.get("vehicle_model") || "";
      text += `<strong>Veículo principal:</strong> ${[y,mk,md].filter(Boolean).join(" ")}<br>`;
    }

    const vehiclesAdd = formData.getAll("additional_vehicle_vin[]").filter(v => v && v.trim() !== "");
    if (vehiclesAdd.length > 0) {
      text += `<strong>Veículos adicionais (VINs):</strong> ${vehiclesAdd.join(", ")}<br>`;
    }

    text += `<strong>Possui seguro de carro atualmente?:</strong> ${formData.get("has_insurance") || ""}<br>`;
    text += `<strong>E-mail:</strong> ${formData.get("email") || ""}<br>`;
    summary.innerHTML = text;
    nextStep();
  }

  // ========= ENVIO FINAL =========
  document.getElementById("autoForm").addEventListener("submit", async function(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    // botão de submit
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.originalText = submitBtn.dataset.originalText || submitBtn.textContent;
      submitBtn.textContent = 'Enviando...';
    }

    function toMMDDYYYY(date) {
      if (!date) return "";
      const [yyyy, mm, dd] = date.split("-");
      return `${mm}/${dd}/${yyyy}`;
    }

    // NOME PRINCIPAL (sem João / Silva)
    const fullNameRaw = (formData.get("main_driver_name") || "").trim();
    let mainFirst = "";
    let mainLast = "";

    if (fullNameRaw) {
      const parts = fullNameRaw.split(/\s+/);
      mainFirst = parts.shift() || "";
      mainLast  = parts.join(" ");
    }

    // E-MAIL E TELEFONE REAIS DO USUÁRIO
    const userEmail = (formData.get("email") || "").trim();
    let userPhone  = (formData.get("phone") || "").trim();
    if (typeof itiInstance !== "undefined" && itiInstance && typeof itiInstance.getNumber === "function") {
      const fullNumber = itiInstance.getNumber();
      if (fullNumber) userPhone = fullNumber;
    }

    // DRIVERS
    const drivers = [{
      first_name: mainFirst,
      last_name: mainLast,
      date_of_birth: toMMDDYYYY(formData.get("main_driver_dob")),
      gender: "male",
      marital_status: "S",
      relationship: "Self",
      years_licensed: "3"
    }];

    const additionalNames = formData.getAll("additional_driver_name[]");
    const additionalDOBs  = formData.getAll("additional_driver_dob[]");

    additionalNames.forEach((name, i) => {
      const nameTrim = (name || "").trim();
      if (nameTrim) {
        const parts = nameTrim.split(/\s+/);
        const first = parts.shift() || "";
        const last  = parts.join(" ");
        drivers.push({
          first_name: first,
          last_name: last,
          date_of_birth: toMMDDYYYY(additionalDOBs[i]),
          gender: "male",
          marital_status: "S",
          relationship: "Other",
          years_licensed: "3"
        });
      }
    });

    // VEÍCULOS (VIN OU MODELO)
    const vinMode = formData.get("vin_option");
    const vehicles = [];

    if (vinMode === "sim") {
      const mainVIN = (formData.get("vehicle_main") || "").trim();
      if (mainVIN) {
        vehicles.push({ vin: mainVIN, ownership_status: "financed" });
      }
    } else {
      const y  = (formData.get("vehicle_year")  || "").trim();
      const mk = (formData.get("vehicle_make") || "").trim();
      const md = (formData.get("vehicle_model")|| "").trim();
      if (y && mk && md) {
        vehicles.push({ year: y, make: mk, model: md, ownership_status: "financed" });
      }
    }

    // VINs adicionais
    const vinExtras = formData.getAll("additional_vehicle_vin[]");
    vinExtras.forEach(vin => {
      const cleanVin = (vin || "").trim();
      if (cleanVin) {
        vehicles.push({ vin: cleanVin, ownership_status: "financed" });
      }
    });

    // LARA PAYLOAD (sem Kamili, sem senha/telefone fixos)
    const laraPayload = {
      personal_info: {
        first_name: mainFirst,
        last_name: mainLast,
        date_of_birth: toMMDDYYYY(formData.get("main_driver_dob")),
        marital_status: "S"
      },
      address_info: {
        address_line1: formData.get("address") || "",
        address_line2: "",
        zipcode: formData.get("zip") || "",
        apartment_type: "apartment",
        rental_status: "rental",
        address_time: "4"
      },
      contact_info: {
        email: userEmail,
        cellphone: userPhone
      },
      vehicles: vehicles.length ? vehicles : [],
      drivers:  drivers.length  ? drivers  : [],
      insurance_info: {
        effective_date: "today",
        credit_check_authorized: "yes",
        expiration_date: "today"
      },
      quote_info: {
        number_of_cars: vehicles.length || 1,
        number_of_additional_drivers: additionalNames.length || 0,
        homeowner_policy_by_agency: "no",
        enroll_in_snapshot: "no"
      },
      auto_quote_settings: {
        template_type: "auto_quote_stand"
      },
      system_settings: {
        wait_time: 2,
        timeout: 20
      },
      headless: true
    };

    // NOVO: URL da página para identificar a origem do formulário
    const currentUrl = window.location.href;

    try {
      await fetch("https://primary-production-2441.up.railway.app/webhook/217cc570-0486-40a3-acd6-5f699556cca5/lara-selenium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...laraPayload,
          user_email: userEmail,
          page_url: currentUrl
        })
      });

      showSuccessModal();
      form.reset();

      if (typeof fbq === "function") {
        fbq('trackCustom', 'CotacaoEnviada');
        fbq('track', 'Lead');
        console.log('Pixel: CotacaoEnviada + Lead');
      }

      setTimeout(() => { location.reload(); }, 8000);
    } catch (err) {
      alert("Erro ao enviar dados. Tente novamente!");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset.originalText || 'Enviar Cotação';
      }
    }
  });

  // MODAL SUCESSO
  let modalTimeout = null;
  window.showSuccessModal = function() {
    document.getElementById('modal-success').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    clearTimeout(modalTimeout);
    modalTimeout = setTimeout(closeSuccessModal, 8000);
  }
  window.closeSuccessModal = function() {
    document.getElementById('modal-success').style.display = 'none';
    document.body.style.overflow = '';
    clearTimeout(modalTimeout);
  }
});


document.addEventListener('DOMContentLoaded', function() {
  function removeAcentos(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z\s.]/g, "");
  }

  document.querySelectorAll('input[name="main_driver_name"], input[name="additional_driver_name[]"]').forEach(function(nomeInput) {
    nomeInput.addEventListener('input', function() {
      var val = removeAcentos(nomeInput.value);
      nomeInput.value = val;
    });
  });

  // Monitorar campos adicionais criados dinamicamente
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      mutation.addedNodes.forEach(function(node) {
        if (node.nodeType === 1) {
          var newNomeInputs = node.querySelectorAll && node.querySelectorAll('input[name="additional_driver_name[]"]');
          if (newNomeInputs && newNomeInputs.length) {
            newNomeInputs.forEach(function(input) {
              input.addEventListener('input', function() {
                var val = removeAcentos(input.value);
                input.value = val;
              });
            });
          }
        }
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Limitar tamanho do input de data
  document.querySelectorAll('input[name="main_driver_dob"], input[name="additional_driver_dob[]"]').forEach(function(dobInput) {
    dobInput.addEventListener('input', function() {
      if (dobInput.value.length > 10) dobInput.value = dobInput.value.slice(0,10);
    });
  });
});

document.addEventListener("DOMContentLoaded", function() {
  const zipInput = document.getElementById("zip");
  const stateInput = document.getElementById("state");
  const addressInput = document.getElementById("address");

  // AUTOCOMPLETE ENDEREÇO
  let autocomplete = new google.maps.places.Autocomplete(addressInput, {
    types: ['address'],
    componentRestrictions: { country: "us" }
  });

  autocomplete.addListener('place_changed', function () {
    let place = autocomplete.getPlace();
    let zip = "", state = "";
    if (place.address_components) {
      place.address_components.forEach(comp => {
        if (comp.types.includes("postal_code")) zip = comp.long_name;
        if (comp.types.includes("administrative_area_level_1")) state = comp.short_name;
      });
      if (zip) zipInput.value = zip;
      if (state) stateInput.value = state;
    }
  });

  // GEOCODER PELO ZIP CODE
  function getAddressByZip(zipCode) {
    let geocoder = new google.maps.Geocoder();
    geocoder.geocode({ 'address': zipCode }, function(results, status) {
      if (status === 'OK' && results[0]) {
        let state = "";
        results[0].address_components.forEach(comp => {
          if (comp.types.includes("administrative_area_level_1")) {
            state = comp.long_name;
          }
        });
        if (state) stateInput.value = state;
      }
    });
  }

  zipInput.addEventListener("blur", function() {
    if (zipInput.value.trim() !== "") {
      getAddressByZip(zipInput.value.trim());
    }
  });
});

document.addEventListener('DOMContentLoaded', function () {
  const allIcons = document.querySelectorAll('.help-icon');
  const allTips  = document.querySelectorAll('.tooltip-pop');

  function closeAllTips() {
    allIcons.forEach(btn => btn.setAttribute('aria-expanded', 'false'));
    allTips.forEach(tp => { tp.dataset.open = 'false'; tp.setAttribute('aria-hidden','true'); });
  }

  allIcons.forEach(btn => {
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();

      const tipId = btn.getAttribute('aria-controls');
      const tip   = document.getElementById(tipId);
      const isOpen = tip?.dataset.open === 'true';

      closeAllTips();
      if (!isOpen && tip) {
        tip.dataset.open = 'true';
        tip.setAttribute('aria-hidden','false');
        btn.setAttribute('aria-expanded','true');
      }
    });
  });

  document.addEventListener('click', closeAllTips);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllTips();
  });
});

