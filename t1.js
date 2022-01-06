function utf8Encode(string) {
	var utftext = "";
	for(var n = 0; n < string.length; n++) {
		var c = string.charCodeAt(n);
		if(c < 128) {
			utftext += String.fromCharCode(c);
		} else if((c > 127) && (c < 2048)) {
			utftext += String.fromCharCode((c >> 6) | 192);
			utftext += String.fromCharCode((c & 63) | 128);
		} else {
			utftext += String.fromCharCode((c >> 12) | 224);
			utftext += String.fromCharCode(((c >> 6) & 63) | 128);
			utftext += String.fromCharCode((c & 63) | 128);
		}
	}
	return utftext;
}

function utf8Decode(inputStr) {
	var outputStr = "";
	var code1, code2, code3, code4;
	for(var i = 0; i < inputStr.length; i++) {
		code1 = inputStr.charCodeAt(i);
		if(code1 < 128) {
			outputStr += String.fromCharCode(code1);
		} else if(code1 < 224) {
			code2 = inputStr.charCodeAt(++i);
			outputStr += String.fromCharCode(((code1 & 31) << 6) | (code2 & 63));
		} else if(code1 < 240) {
			code2 = inputStr.charCodeAt(++i);
			code3 = inputStr.charCodeAt(++i);
			outputStr += String.fromCharCode(((code1 & 15) << 12) | ((code2 & 63) << 6) | (code3 & 63));
		} else {
			code2 = inputStr.charCodeAt(++i);
			code3 = inputStr.charCodeAt(++i);
			code4 = inputStr.charCodeAt(++i);
			outputStr += String.fromCharCode(((code1 & 7) << 18) | ((code2 & 63) << 12) | ((code3 & 63) << 6) | (code2 & 63));
		}
	}
	return outputStr;
}

function stringtouint8array(str, ifzero) {
	let arr = new Uint8Array(str.length + (ifzero ? 1 : 0))
	for(let i = 0; i < str.length; i++) {
		arr[i] = str.charCodeAt(i)
	}
	return arr
}

function concatuint8array(arrays) {
	let length = arrays.reduce((a, b) => a + b.length, 0)
	let result = new Uint8Array(length)
	let start = 0
	arrays.map(x => {
		result.set(x, start)
		start += x.length
	})
	return result
}

function arraytostring(arr) {
	let str = ""
	for(let i = 0; i < arr.length; i++) {
		str = str + String.fromCharCode(arr[i])
	}
	return str
}


function wrap(fileArray) {
	return Promise.all(Array.from(fileArray).map(file =>

		new Promise((resolve, reject) => {
			let filereader = new FileReader()
			filereader.readAsArrayBuffer(file)
			filereader.onload = (e) => {
				let result = new Uint8Array(e.target.result)
				result.metadata = {
					name: utf8Encode(file.name),
					mime: file.type,
					length: result.length
				}
				resolve(result)
			}
			filereader.onerror = reject
		})

	)).then(arr => {

		let meta = {
			id: "B00" + Math.random().toString(16).slice(2),
			slice: 1,
			length: arr.reduce((a, b) => a + b.metadata, 0),
			data: arr.map(x => x.metadata)
		}

		return concatuint8array([stringtouint8array(JSON.stringify(meta), true)].concat(arr))
	})
}

function unwrap(arr) {
	let i = 0
	while(arr[++i] != 0);
	let meta = JSON.parse(arraytostring(arr.slice(0, i)))
	let data = arr.slice(i + 1)
	let index = 0
	let files = []
	for(let j = 0; j < meta.data.length; j++) {
		files.push(new File([
			data.slice(index, index += meta.data[j].length)
		], utf8Decode(meta.data[j].name), {
			type: meta.data[j].mime
		}))
	}
	return files
}

function datatoimgblob(data) {
	return new Promise((resolve, reject) => {
		let width = Math.max(100, Math.ceil(Math.sqrt(data.length / 3)))
		let height = width
		let cvs = document.createElement("canvas")
		let ctx = cvs.getContext("2d")
		cvs.width = width
		cvs.height = height
		let max = width * height
		let imgdata = ctx.getImageData(0, 0, width, height)
		let j = 0
		for(let i = 0; i < max; i++) {
			imgdata.data[i * 4] = data[j++]
			imgdata.data[i * 4 + 1] = data[j++]
			imgdata.data[i * 4 + 2] = data[j++]
			imgdata.data[i * 4 + 3] = 255
		}
		ctx.putImageData(imgdata, 0, 0)
		cvs.toBlob(resolve)
	})
}

function imgblobtodata(blob) {
	return new Promise((resolve, reject) => {
		let img = new Image()
		img.src = URL.createObjectURL(blob)
		img.onload = () => {
			URL.revokeObjectURL(img.src)
			let width = img.width
			let height = img.height
			let result = new Uint8Array(width * height * 3)
			let cvs = document.createElement("canvas")
			let ctx = cvs.getContext("2d")
			cvs.width = width
			cvs.height = height
			ctx.drawImage(img, 0, 0)
			let imgdata = ctx.getImageData(0, 0, width, height)
			let j = 0
			for(let i = 0; i < width * height; i++) {
				result[j++] = imgdata.data[4 * i]
				result[j++] = imgdata.data[4 * i + 1]
				result[j++] = imgdata.data[4 * i + 2]
			}
			resolve(result)
		}
	})
}

let srclist = []
let display = document.createElement("div")
display.style.padding = "1rem"

function clear() {
	display.innerHTML = ""
	srclist.map(x => URL.revokeObjectURL(x))
	srclist = []
}

function createdisplay(b, n) {
	let src = URL.createObjectURL(b)
	srclist.push(b)

	let div = document.createElement("div")
	div.style.paddingTop = "0.5rem"

	let div2 = document.createElement("div")
	div2.style.wordBreak = "break-all"
	div.appendChild(div2)

	let a = document.createElement("a")
	a.innerText = "保存"
	a.href = src
	a.download = n || ""
	div2.appendChild(a)

	let span = document.createElement("span")
	span.innerText = n || ""
	span.innerHTML = "&emsp;" + span.innerHTML
	div2.appendChild(span)

	if(b.type.indexOf("image") > -1) {
		let img = document.createElement("img")
		img.style.maxWidth = "100%"
		img.src = src
		div.appendChild(img)
	}

	if(b.type.indexOf("video") > -1) {
		let img = document.createElement("video")
		img.controls = true
		img.style.maxWidth = "100%"
		img.src = src
		div.appendChild(img)
	}
	return div
	
}

function createwrong(t) {
	let div = document.createElement("div")
	div.style.paddingTop = "0.5rem"
	div.style.wordBreak = "break-all"
	div.innerText = t + " 读取错误"
	return div
}

function readweb(webs) {
	clear()

	if(webs.length == 0) {
		return
	}
    
    let info = document.createElement("div")
    display.appendChild(info)
    
	let l = webs.length
	let j = webs.length
	info.innerText = "loading 0/" + l
	function reduce() {
		info.innerText = (--j > 0) ? ("loading " + (l - j) + "/" + l) : ""
	    
	}

	webs.map(web => {
		let xml = new XMLHttpRequest()
		xml.open("GET", web)
		xml.responseType = "blob"
		xml.onreadystatechange = () => {
			if(xml.readyState == XMLHttpRequest.DONE)
				if(xml.status == 200) {
					let f = xml.response
					imgblobtodata(f)
						.then(unwrap)
						.then(arr => arr.map(x => {
							display.appendChild(createdisplay(x, x.name))
						}))
						.catch(e => {
							display.appendChild(createwrong(web))
						})
						.finally(reduce)
				} else {
					display.appendChild(createwrong(web))
					reduce()
				}

		}
		xml.send()
	})
}

function tp(webs) {
	window.onload = () => {
		document.body.innerHTML = ""
		document.body.appendChild(display)
		readweb(webs)
	}
}
