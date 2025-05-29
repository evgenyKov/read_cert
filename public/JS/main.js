//===============================================================================

const PK_FORM_TYPE_FILE = 1;
const PK_FORM_TYPE_KM = 2;
const PK_FORM_TYPE_KSP = 3;


var EU_SIGN_TYPE_UNKNOWN = 0;
var EU_SIGN_TYPE_CADES_BES = 1;
var EU_SIGN_TYPE_CADES_T = 4;
var EU_SIGN_TYPE_CADES_C = 8;
var EU_SIGN_TYPE_CADES_X_LONG = 16;
var EU_SIGN_TYPE_CADES_X_LONG_TRUSTED = 128;

var EU_SIGN_TYPE_PARAMETER = 'SignType';

var CAdESTypes = [
	EU_SIGN_TYPE_CADES_BES,
	EU_SIGN_TYPE_CADES_T,
	EU_SIGN_TYPE_CADES_C,
	EU_SIGN_TYPE_CADES_X_LONG,
	EU_SIGN_TYPE_CADES_X_LONG | EU_SIGN_TYPE_CADES_X_LONG_TRUSTED
];


let signedFileData;
let signedFileName;

//===============================================================================

// Налаштування бібліотеки
var euSettings = {
	language: "uk",
	encoding: "utf-8",
	httpProxyServiceURL: "/proxyHandler",
//	httpProxyServiceURL: "http:localhost:4000",
	directAccess: true,
	CAs: "./Data/CAs.json",
	CACertificates: "./Data/CACertificates.p7b",
	allowedKeyMediaTypes: [
		"е.ключ ІІТ Алмаз-1К", 
		"е.ключ ІІТ Кристал-1",
		"ID-карта громадянина (БЕН)",
		"е.ключ ІІТ Алмаз-1К (PKCS#11)",
		"е.ключ ІІТ Кристал-1 (PKCS#11)"
	],
	// Реєстрація хмарних провайдерів
	"KSPs": [
		{
			"ID": "Vcahsno",
			"name": "Вчасно - хмарний підпис",
			"ksp": 4,
			"address": "https://cs.vchasno.ua/ss",
			"port": "",
			//"directAccess": true
		},
		{
			"ID": "PrivatBank",
			"name": "Приватбанк - хмарний підпис \"SmartID\"",
			"ksp": 6,
			"address": "https://acsk.privatbank.ua/cloud/api/back",
			"port": "",
//			"directAccess": true,
			"clientIdPrefix": "IEIS_",
			"confirmationURL": "https://www.privat24.ua/rd/kep?hash=rd/kep/",
			"mobileAppName": "Приват24"
		},
		{
			"name": "ІІТ - хмарний підпис",
			"ksp": EndUserConstants.EndUserKSP.IIT,
			"address": "https://sserver2.iit.com.ua",
			"port": "443"
		},
	]
};


/*
{
	"Diia": {
	  "ID": "Diia",
	  "name": "ДіЯ",
	  "ksp": 7,
	  "address": "Diia",
	  "port": "",
	  "directAccess": true,
	  "confirmationURL": "https://diia.page.link?link=",
	  "mobileAppName": "ДіЯ"
	},
	"DepositSign": {
	  "ID": "DepositSign",
	  "name": "DepositSign - хмарний підпис",
	  "ksp": 4,
	  "address": "https://depositsign.com/api/v1/unitybase/sign-server",
	  "port": "",
	  "directAccess": true
	},
	"CloudKey": {
	  "ID": "CloudKey",
	  "name": "ТОВ «ЦСК «Україна» - хмарний підпис CloudKey",
	  "ksp": 6,
	  "address": "https://sid.uakey.com.ua/smartid/iit",
	  "port": "",
	  "directAccess": true,
	  "clientIdPrefix": "DIIA_2",
	  "confirmationURL": "https://sid.uakey.com.ua/kep?hash=rd/kep/",
	  "mobileAppName": "CloudKey"
	},
	"ESign": {
	  "ID": "ESign",
	  "name": "ESign - хмарний підпис",
	  "ksp": 4,
	  "address": "https://cabinet.e-life.com.ua/api/EDG/Sign",
	  "port": "",
	  "directAccess": true
	},
	"PUMB": {
	  "ID": "PUMB",
	  "name": "ПУМБ - хмарний підпис",
	  "ksp": 6,
	  "address": "https://apiext.pumb.ua/hogsmeade/striga/v1",
	  "port": "",
	  "directAccess": false,
	  "clientIdPrefix": "DIIA_3",
	  "confirmationURL": "https://www.digital.pumb.ua/digital-mobile/getapp",
	  "mobileAppName": "ПУМБ Digital Business"
	},
	"DPS": {
	  "ID": "DPS",
	  "name": "ІДД ДПС - хмарний підпис",
	  "ksp": 4,
	  "address": "https://smart-sign.tax.gov.ua",
	  "port": "443",
	  "directAccess": true,
	  "clientIdType": 1
	}
   }
   
*/




// Бібліотека для роботи з файловими ключами та серверами підпису, що не потребує 
// встановлення додатково ПЗ
var euSignFile = new EndUser(
	"JS\\euscp.worker.ex.js", 
	EndUserConstants.EndUserLibraryType.JS);
	
// Бібліотека для роботи з аппаратними носіями, що потребує 
// встановлення додатково ПЗ бібліотек веб-підпису, веб-розширення для браузера
var euSignKeyMedia = new EndUser(
	null, 
	EndUserConstants.EndUserLibraryType.SW);
var keyMedias = [];

var euSign = euSignFile;
var formType = PK_FORM_TYPE_FILE;

//===============================================================================

function readFile(file) {
	return new Promise(function(resolve, reject) {
		var reader = new FileReader();
		reader.onloadend  = function(evt) {
			if (evt.target.readyState != FileReader.DONE)
				return;

			resolve({
				"file": file,
				"data": new Uint8Array(evt.target.result)
			});
		};
		reader.readAsArrayBuffer(file);
	});
}

//===============================================================================

function setKeyMedias(_keyMedias) {
	keyMedias = _keyMedias;

	var kmSelect = document.getElementById('pkKeyMediaSelect');
	
	var length = kmSelect.options.length;
	for (i = length-1; i >= 0; i--) {
	  kmSelect.options[i] = null;
	}
	
	for (var i = 0; i < keyMedias.length; i++) {
		var opt = document.createElement('option');
		opt.appendChild( document.createTextNode(keyMedias[i].visibleName) );
		opt.value = keyMedias[i].visibleName; 
		kmSelect.appendChild(opt); 
	}	
}

//===============================================================================

function getSelectedKeyMedia() {
	var kmSelected = document.getElementById('pkKeyMediaSelect').value;
	
	for (var i = 0; i < keyMedias.length; i++) {
		if (keyMedias[i].visibleName == kmSelected)
			return keyMedias[i];
	}

	return null;
}

//===============================================================================

function setKSPs() {
	var kspSelect = document.getElementById('pkKSPSelect');
	
	var length = kspSelect.options.length;
	for (i = length-1; i >= 0; i--) {
		kspSelect.options[i] = null;
	}
	
	for (var i = 0; i < euSettings.KSPs.length; i++) {
		var opt = document.createElement('option');
		opt.appendChild( document.createTextNode(
			euSettings.KSPs[i].name) );
		opt.value = euSettings.KSPs[i].name; 
		kspSelect.appendChild(opt); 
	}
}

//===============================================================================

function getSelectedKSP() {
	var kspSelected = document.getElementById('pkKSPSelect').value;
	
	for (var i = 0; i < euSettings.KSPs.length; i++) {
		if (euSettings.KSPs[i].name == kspSelected)
			return euSettings.KSPs[i];
	}

	return null;
}

//===============================================================================

/*
	Обробник сповіщень на підтвердження операції з використання ос. ключа 
	за допомогою сканування QR-коду в мобільному додатку сервісу підпису
*/
function onConfirmKSPOperation(kspEvent) {
	var node = '';
	node += '<a href="' + encodeURI(kspEvent.url) + '" target="_blank">';
	node += 	'<img src="data:image/bmp;base64,' + 
		kspEvent.qrCode + '" style="padding: 10px; background: white;">';
	node += '</a>'

	document.getElementById('pkKSPQRImageBlock').innerHTML = node;
	document.getElementById('pkKSPQRBlock').style.display = 'block';
}

//===============================================================================

function setLibraryType(type) {
	var pkFileBlock = document.getElementById('pkFileBlock');
	var pkKeyMediaBlock = document.getElementById('pkKeyMediaBlock');
	var pkKSPBlock = document.getElementById('pkKSPBlock');
	var signBlock = document.getElementById('signBlock');
	
	formType = type;
	
	switch (type) {
		case PK_FORM_TYPE_FILE:
			pkFileBlock.style.display = 'block';
			pkKeyMediaBlock.style.display = 'none';
			pkKSPBlock.style.display = 'none';
			euSign = euSignFile;
		break;

		case PK_FORM_TYPE_KM:
			pkFileBlock.style.display = 'none';
			pkKeyMediaBlock.style.display = 'block';
			pkKSPBlock.style.display = 'none';
			euSign = euSignKeyMedia;
		break;
		
		case PK_FORM_TYPE_KSP:
			pkFileBlock.style.display = 'none';
			pkKeyMediaBlock.style.display = 'none';
			pkKSPBlock.style.display = 'block';
			euSign = euSignFile;
		break;
	}
	
	initialize()
	.then(function() {
		if (euSign == euSignFile)
			return [];
		
		return euSign.GetKeyMedias();
	})
	.then(function(keyMedias) {
		setKeyMedias(keyMedias);
		
	})
	.catch(function(e) {
		var msg = (e.message || e);
		
		console.log("Initialize error: " + msg);

		alert('Виникла помилка при ініціалізації бібліотеки. ' + 
			'Опис помилки: ' + msg);
	})
}

/*
function DSCAdESTypeChanged() {
	alert('DSCAdESTypeChanged')
	var signType = CAdESTypes[
		document.getElementById('DSCAdESTypeSelect').selectedIndex];
	try {
		euSign.SetRuntimeParameter(EU_SIGN_TYPE_PARAMETER, signType);
	} catch (e) {
		alert(e);
	}

	document.getElementById('SignAddCAsCertificatesCheckbox').disabled = 
		((signType & EU_SIGN_TYPE_CADES_X_LONG) == 
			EU_SIGN_TYPE_CADES_X_LONG) ? '' : 'disabled';
}
*/
//===============================================================================

// Ініціалізація бібліотеки
function initialize() {
	return new Promise(function(resolve, reject) {
		var isInitialized = false;
		
		if (euSign == euSignFile) {
			euSign.IsInitialized()
			.then(function(result) {
				isInitialized = result;
				if (isInitialized) {
					console.log("EndUser: JS library already initialized");
					return;
				}
				
				console.log("EndUser: JS library initializing...");
				return euSign.Initialize(euSettings);
			}).then(function() {
				if (isInitialized)
					return;

				console.log("EndUser: JS library initialized");

				setKSPs();

				console.log("EndUser: event listener for KSPs registering...");
				
				return euSign.AddEventListener(
					EndUserConstants.EndUserEventType.ConfirmKSPOperation,
					onConfirmKSPOperation);
			}).then(function() {
				if (!isInitialized)
					console.log("EndUser: event listener for KSPs registered");

				isInitialized = true;
				resolve();
			})
			.catch(function(e) {
				reject(e);
			});
		} else {
			// Перевірка чи встановлені необхідні модулі для роботи криптографічної бібліотеки
			euSign.GetLibraryInfo()
			.then(function(result) {
				if (!result.supported) {
					throw "Бібліотека web-підпису не підтримується " + 
						"в вашому браузері або ОС";
				}
				
				if (!result.loaded) {
					// Бібліотека встановлена, але потребує оновлення
					if (result.isNativeLibraryNeedUpdate) {
						throw "Бібліотека web-підпису потребує оновлення. " + 
							"Будь ласка, встановіть оновлення за посиланням " + 
							result.nativeLibraryInstallURL;
					}
					
					// Якщо браузер підтримує web-розширення рекомендується 
					// додатково до нативних модулів встановлювати web-розширення
					// Увага! Встановлення web-розширень ОБОВ'ЯЗКОВЕ для ОС Linux та ОС Windows Server
					if (result.isWebExtensionSupported &&
						!result.isWebExtensionInstalled) {
						throw "Бібліотека web-підпису потребує встановлення web-розширення. " + 
							"Будь ласка, встановіть web-розширення за посиланням " + 
							result.webExtensionInstallURL + " та оновіть сторінку";
					}
					
					// Бібліотека (нативні модулі) не встановлені 
					throw "Бібліотека web-підпису потребує встановлення. " + 
						"Будь ласка, встановіть бібліотеку за посиланням " + 
						result.nativeLibraryInstallURL + " та оновіть сторінку";
				}
				
				return euSign.IsInitialized();
			})
			.then(function(result) {
				isInitialized = result;
				if (isInitialized) {
					console.log("EndUser: SW library already initialized");
					return;
				}
				
				console.log("EndUser: SW library initializing...");
				return euSign.Initialize(euSettings)
			}).then(function() {
				if (!isInitialized)
					console.log("EndUser: SW library initialized");

				resolve()
			})
			.catch(function(e) {
				reject(e);
			});
		}
	});
}

//===============================================================================

function readPrivateKey() {
	var pkFileInput = formType == PK_FORM_TYPE_FILE ? 
		document.getElementById('pkFile') : null;
	var passwordInput = formType != PK_FORM_TYPE_KSP ? 
		document.getElementById(formType == PK_FORM_TYPE_FILE ? 
			'pkFilePassword' : 'pkKeyMediaPassword') : null;
	var selectedKM = formType == PK_FORM_TYPE_KM ? getSelectedKeyMedia() : null;
	var kmSelect = document.getElementById('pkKeyMediaSelect');
	var ksp = formType == PK_FORM_TYPE_KSP ? getSelectedKSP() : null;
	var userIdInput = formType == PK_FORM_TYPE_KSP ? 
		document.getElementById('pkKSPUserId') : null;
	/*
		Загальне ім'я ЦСК з списку CAs.json, який видав сертифікат для ос. ключа.
		Якщо null бібліотека намагається визначити ЦСК автоматично за 
		сервером CMP\сертифікатом. Встановлюється у випадках, коли ЦСК не 
		підтримує CMP, та для пришвидшення пошуку сертифіката ос. ключа
	*/
	var caCN = null;
	/*
		Сертифікати, що відповідають ос. ключу (масив об'єктів типу Uint8Array). 
		Якщо null бібліотека намагається завантажити їх з ЦСК автоматично з сервера CMP.
		Встановлюється у випадках, коли ЦСК не підтримує CMP, та для пришвидшення 
		пошуку сертифіката ос. ключа
	*/
	var pkCertificates = null;
		
	return new Promise(function(resolve, reject) {
		switch (formType)
		{
		case PK_FORM_TYPE_FILE: 
			if (pkFileInput.value == null || 
					pkFileInput.value == '') {
				pkFileInput.focus();

				reject('Не обрано файл з ос. ключем');

				return;
			}
			
			if (passwordInput.value == null || 
					passwordInput.value == '') {
				passwordInput.focus();
				reject('Не вказано пароль до ос. ключа');

				return;
			}
			
			readFile(pkFileInput.files[0])
			.then(function(result) {
				console.log("Private key file readed");

				// Якщо файл з ос. ключем має розширення JKS, ключ може містити декілька ключів, 
				// для зчитування такого ос. ключа необхіно обрати який ключ повинен зчитуватися
				if (result.file.name.endsWith(".jks")) {
					return euSign.GetJKSPrivateKeys(result.data)
						.then(function(jksKeys){
							console.log("EndUser: jks keys got");
							
							// Для спрощення прикладу обирається перший ключ
							var pkIndex = 0;
							
							pkCertificates = [];
							for (var i = 0; i < jksKeys[pkIndex].certificates.length; i++)
								pkCertificates.push(jksKeys[pkIndex].certificates[i].data);
							
							return euSign.ReadPrivateKeyBinary(
								jksKeys[pkIndex].privateKey, 
								passwordInput.value, pkCertificates, caCN);
						});
				}
				
				return euSign.ReadPrivateKeyBinary(
					result.data, passwordInput.value, pkCertificates, caCN);
			})
			.then(function(result) {
				resolve(result)
			})
			.catch(function(e) {
				reject(e);
			});
			
			break;
			
		case PK_FORM_TYPE_KM:
			if (!selectedKM) {
				kmSelect.focus();

				reject('Не обрано носій з ос. ключем');

				return;
			}
			
			if (passwordInput.value == null || 
					passwordInput.value == '') {
				passwordInput.focus();
				reject('Не вказано пароль до ос. ключа');

				return;
			}
		
			var keyMedia = new EndUserKeyMedia(selectedKM);
			keyMedia.password = passwordInput.value;
			
			euSign.ReadPrivateKey(keyMedia, pkCertificates, caCN)
			.then(function(result) {
				resolve(result)
			})
			.catch(function(e) {
				reject(e);
			});

			break;
		
		case PK_FORM_TYPE_KSP:
			if (ksp == null) {
				reject('Не обрано сервіс підпису');

				return;
			}

			if (!ksp.confirmationURL && 
					(userIdInput.value == null || 
					userIdInput.value == '')) {
				userIdInput.focus();

				reject('Не вказано ідентифікатор користувача');
				
				return;
			}

			document.getElementById('pkKSPQRImageLabel').innerHTML = 
				'Відскануйте QR-код для зчитування ос. ключа в моб. додатку:';

			euSign.ReadPrivateKeyKSP(
				!ksp.confirmationURL ? 
					userIdInput.value : '', ksp.name)
			.then(function(result) {
				console.log('===KSP RESULT', result)
				document.getElementById('pkKSPQRBlock').style.display = 'none';
				resolve(result)
			})
			.catch(function(e) {
				document.getElementById('pkKSPQRBlock').style.display = 'none';
				reject(e);
			});

			break;
		}
	});
}

//===============================================================================
/*
function tasignDa() {
	var dataInput = document.getElementById('data-textarea');
	var signInput = document.getElementById('sign-textarea');

	readPrivateKey()
	.then(function(result) {
		if (result) {
			console.log("EndUser: private key readed " + result.subjCN + ".");
		}

		console.log('result', result)

		if (formType == PK_FORM_TYPE_KSP) {
			document.getElementById('pkKSPQRImageLabel').innerHTML  = 
					'Відскануйте QR-код для підпису в моб. додатку:';
		}

		return euSign.SignDataInternal(true, dataInput.value, true);
	})
	.then(function(sign) {
		console.log("EndUser: data signed");
		console.log("Data: " + dataInput.value);
		console.log("Sign: " + sign);

		signInput.value = sign;

		if (formType == PK_FORM_TYPE_KSP)
			document.getElementById('pkKSPQRBlock').style.display = 'none';

		alert('Дані успішно підписані');
	})
	.catch(function(e) {
		if (formType == PK_FORM_TYPE_KSP)
			document.getElementById('pkKSPQRBlock').style.display = 'none';
		
		var msg = (e.message || e);
		
		console.log("Sign data error: " + msg);

		alert('Виникла помилка при підписі даних. ' + 
			'Опис помилки: ' + msg);
	});
}
*/
//===============================================================================

/*
function readSignFile(input) {
    let file = input.files[0];
	signedFileName = file.name;
    let reader = new FileReader();
  
    reader.readAsArrayBuffer(file);
  
    reader.onload = function() {
        signedFileData = reader.result;
    };
  
    reader.onerror = function() {
      console.log(reader.error);
    };
  
  }


  function base64ToArrayBuffer(e) {
	let n = window.atob(e),
	  t = n.length,
	  i = new Uint8Array(t);
	for (let e = 0; e < t; e++) i[e] = n.charCodeAt(e);
	return i;
  }
  
  function arrayBufferToBase64(e) {
	const n = [];
	return (
	  e.forEach((e) => {
		n.push(String.fromCharCode(e));
	  }),
	  btoa(n.join(""))
	);
  
  }

async function saveFile(data, filename) {
	console.log('====FILENAME', filename)
	const arrBuff = base64ToArrayBuffer(data);
	if (!window.showSaveFilePicker) {
		const link = document.createElement('a');
		link.download = filename || 'signedFile.p7s';	
		link.href = URL.createObjectURL(new Blob([arrBuff], {type: 'application/octet-binary'}));
		link.click();
		return;
	}
    const fileHandle = await window.showSaveFilePicker(filename ? {
		 suggestedName: filename,} : {});
    const fileStream = await fileHandle.createWritable();

    await fileStream.write(new Blob([arrBuff], {type: 'application/octet-binary'}));
    await fileStream.close(); 
}   
  
function signFile() {
	const signedFile = document.getElementById('signedFile');
    if (!signedFileData) {
        alert('Не вибрано файл для підпису')
        return;
    }
	const dataToSign = new Uint8Array(signedFileData);

    readPrivateKey()
	.then(function(result) {
		console.log("====KEY " + result.subjCN + ".");
		return euSign.SignDataInternal(true, dataToSign, true);
		//return euSign.SignDataEx(1, signedFileData, true, true, true)
	})
	.then(function(sign) {
		console.log("EndUser: data signed", sign);
	    saveFile(sign, `${signedFileName}.p7s`)
    })
	.catch(function(e) {
		var msg = (e.message || e);
		
		console.log("Sign data error: " + msg);

		alert('Виникла помилка при підписі даних. ' + 
			'Опис помилки: ' + msg);
	});

}
*/
const readCertificate = () => {	
	readPrivateKey()
	.then(function(result) {
		console.log('RESULT', result)
		const { subjEDRPOUCode, subjDRFOCode } = result || {};
		console.log(subjEDRPOUCode, subjDRFOCode)
		if (subjEDRPOUCode) {
			document.getElementById('EDRPOU').innerHTML = subjEDRPOUCode;
		}
		if (subjDRFOCode) {
			document.getElementById('DRFO').innerHTML = subjDRFOCode;
		}

	})
	.catch(function(e) {
		var msg = (e.message || e);
		alert('Виникла помилка при зчитуванні. ' +
			'Опис помилки: ' + msg);
	});
}


window.onload = function() {
	document.getElementById('pkTypeFile').addEventListener(
		'click', function() {
			setLibraryType(PK_FORM_TYPE_FILE)
		}, false);
		
	document.getElementById('pkTypeKeyMedia').addEventListener(
		'click', function() {
			setLibraryType(PK_FORM_TYPE_KM)
		}, false);

	document.getElementById('pkTypeKSP').addEventListener(
		'click', function() {
			setLibraryType(PK_FORM_TYPE_KSP)
		}, false);

	document.getElementById('pkKSPSelect').addEventListener(
		'change', function() {
			var ksp = getSelectedKSP();
			document.getElementById('pkKSPUserIdBlock').style.display = 
				(ksp != null && ksp.confirmationURL) ? 
				'none' : 'block';
		}, false);

	
	setLibraryType(PK_FORM_TYPE_FILE);
}

//===============================================================================