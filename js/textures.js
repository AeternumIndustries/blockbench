//Textures
class Texture {
	constructor(data, uuid) {
		var scope = this;
		//Info
		this.id = '';
		this.name = ''
		this.folder = '';
		this.namespace = '';
		this.path = ''
		this.particle = false
		//meta
		this.source = ''
		this.selected = false
		this.show_icon = true
		this.dark_box = false
		this.error = 0;
		//Data
		this.ratio = 1
		this.img = 0;
		this.res = 0;
		this.saved = true

		this.mode = isApp ? 'link' : 'bitmap';
		this.uuid = uuid || guid()

		if (typeof data === 'object') {
			this.extend(data)
		}
		if (!this.id) {
			var i = textures.length;
			while (true) {
				var c = 0
				var duplicates = false;
				while (c < textures.length) {
					if (textures[c].id == i) {
						duplicates = true;
					}
					c++;
				}
				if (duplicates === true) {
					i++;
				} else {
					this.id = i.toString();
					break;
				}
			}
		}
		//Setup Img/Mat
		var img = this.img = new Image()
		img.src = 'assets/missing.png'

		var tex = new THREE.Texture(img)
		img.tex = tex;
		img.tex.magFilter = THREE.NearestFilter
		img.tex.minFilter = THREE.NearestFilter

		var mat = new THREE.MeshLambertMaterial({
			color: 0xffffff,
			map: tex,
			transparent: settings.transparency.value,
			side: display_mode || Blockbench.entity_mode ? 2 : 0,
			alphaTest: 0.2
		});
		Canvas.materials[this.uuid] = mat

		this.img.onload = function() {
			if (!this.src) return;
			this.tex.needsUpdate = true;
			scope.res = img.naturalWidth;
			scope.ratio = img.naturalWidth / img.naturalHeight;

			if (scope.isDefault) {
				console.log('Successfully loaded '+scope.name+' from default pack')
			}

			var average_color = getAverageRGB(this)
			scope.dark_box = (average_color.r + average_color.g + average_color.b) >= 383

			//Width / Animation
			if (img.naturalWidth !== img.naturalHeight && Blockbench.entity_mode === false) {
				if (img.naturalHeight % img.naturalWidth !== 0) {
					scope.error = 2;
					Blockbench.showQuickMessage('message.square_textures')
				}
			}


			

			//--------------------------------------------------------------------------

			if (Blockbench.entity_mode && textures.indexOf(scope) === 0) {
				if (!scope.keep_size) {
					var size = {
						pw: Project.texture_width,
						ph: Project.texture_height,
						nw: img.naturalWidth,
						nh: img.naturalHeight
					}
					if (false && (scope.old_width != size.nw || scope.old_height != size.nh) && (size.pw != size.nw || size.ph != size.nh)) {
						Blockbench.showMessageBox({
							translateKey: 'update_res',
							icon: 'photo_size_select_small',
							buttons: [tl('message.update_res.update'), tl('dialog.cancel')],
							confirm: 0,
							cancel: 1
						}, function(result) {
							if (result === 0) {
								var lockUV = ( // EG. Texture Optimierung > Modulo geht nicht in allen Bereichen auf
									(size.pw%size.nw || size.ph%size.nh) &&
									(size.nw%size.pw || size.nh%size.ph)
								)
								entityMode.setResolution(img.naturalWidth, img.naturalHeight, lockUV)
								if (selected.length) {
									main_uv.loadData()
									main_uv.setGrid()
								}
							}
						})
					}
					scope.old_width = img.naturalWidth
					scope.old_height = img.naturalHeight
				}
			}

			//--------------------------------------------------------------------------




			if ($('.dialog#texture_edit:visible').length > 0 && scope.selected === true) {
				scope.openMenu()
			}
			TextureAnimator.updateButton()
			Canvas.updateAllFaces(scope)
			if (typeof scope.load_callback === 'function') {
				scope.load_callback(scope);
				delete scope.load_callback;
			}
		}
		this.img.onerror = function() {
			if (isApp &&
				!scope.isDefault &&
				scope.mode !== 'bitmap' &&
				scope.fromDefaultPack()
			) {
				return true;
			} else {
				scope.loadEmpty()
			}
		}
	}
	get frameCount() {
		if (1/this.ratio % 1 === 0) {
			return 1/this.ratio
		}
	}
	getErrorMessage() {
		switch (this.error) {
			case 0: return ''; break;
			case 1: return tl('texture.error.file'); break;
			case 1: return tl('texture.error.invalid'); break;
			case 2: return tl('texture.error.ratio'); break;
			case 3: return tl('texture.error.parent'); break;
		}
	}
	getUndoCopy(bitmap) {
		var copy = {
			path: this.path,
			name: this.name,
			folder: this.folder,
			namespace: this.namespace,
			id: this.id,
			particle: this.particle,
			selected: this.selected,
			mode: this.mode,
			saved: this.saved,
			uuid: this.uuid,
			old_width: this.old_width,
			old_height: this.old_height
		}
		if (bitmap || this.mode === 'bitmap') {
			copy.source = this.source
		}
		return copy
	}
	extend(data) {
		Merge.string(this, data, 'path')
		Merge.string(this, data, 'name')
		Merge.string(this, data, 'folder')
		Merge.string(this, data, 'namespace')
		Merge.string(this, data, 'id')
		Merge.boolean(this, data, 'particle')
		Merge.string(this, data, 'mode')
		Merge.boolean(this, data, 'saved')
		if (this.mode === 'bitmap') {
			Merge.string(this, data, 'source')
		} else if (data.path) {
			this.source = this.path + '?' + tex_version;
		}
		return this;
	}
	//Loading
	load(cb) {
		this.error = 0;
		this.show_icon = true;
		this.img.src = this.source;
		this.load_callback = cb;
		return this;
	}
	fromJavaLink(link, path_array) {
		if (typeof link !== 'string' || (link.substr(0, 1) === '#' && !link.includes('/'))) {
			this.load();
			return this;
		}
		if (link.substr(0, 22) === 'data:image/png;base64,') {
			this.fromDataURL(link)
			return this;
		}
		if (isApp && (link.substr(1, 2) === ':\\' || link.substr(1, 2) === ':/')) {
			var path = link.replace(/\\|\//g, osfs).replace(/\?\d+/g, '')
			this.fromPath(path)
			return this;
		}
		var can_load = !!path_array.length
		var spaces = link.split(':')
		if (spaces.length > 1) {
			this.namespace = spaces[0]
			link = spaces[1]
			path_array[path_array.length-1] = this.namespace
		}
		path_array.push('textures', link.replace(/\//g, osfs))
		var path = path_array.join(osfs)+'.png'
		if (path && can_load) {
			this.fromPath(path)
		} else {
			this.path = path
			this.folder = link.replace(/\\/g, '/').split('/')
			this.folder = this.folder.splice(0, this.folder.length-1).join('/')
			this.name = pathToName(path, true)
			this.mode = 'link'
			this.saved = true
			this.load()
		}
		return this;
	}
	fromFile(file) {
		if (!file) return this;
		if (file.name) this.name = file.name
		if (typeof file.content === 'string' && file.content.substr(0, 4) === 'data') {
			this.fromDataURL(file.content)

			if (!file.path) {
			} else if (pathToExtension(file.path) === 'png') {
				this.path = file.path
			} else if (pathToExtension(file.path) === 'tga') {
				this.path = ''
			}

		} else if (isApp) {
			this.fromPath(file.path)
		}
		this.saved = true
		return this;
	}
	fromPath(path) {
		var scope = this;
		if (path && pathToExtension(path) === 'tga') {
			var targa_loader = new Targa()
			targa_loader.open(path, function() {
				scope.fromFile({
					name: pathToName(path, true),
					path: path,
					content: targa_loader.getDataURL()
				})
			})
			return this;
		}
		this.path = path
		this.name = pathToName(path, true)
		this.mode = 'link'
		this.saved = true
		if (path.includes('data:image')) {
			this.source = path
		} else {
			this.source = path + '?' + tex_version
		}
		this.generateFolder(path)
		this.startWatcher()
		
		if (!isApp && Project.dataURLTextures) {
			this.loadEmpty()

		} else if (EditSession.active) {
			this.load(() => {
				var before = {textures: {}}
				before.textures[scope.uuid] = true;
				this.edit()
				var post = new Undo.save({textures: [this]})
				EditSession.sendEdit({
					before: before,
					post: post,
					action: 'loaded_texture',
					save_history: false
				})
			})
		} else {
			this.load()
		}
		return this;
	}
	fromDataURL(data_url) {
		this.source = data_url
		this.mode = 'bitmap'
		this.saved = false;
		this.load()
		return this;
	}
	fromDefaultPack() {
		if (isApp && settings.default_path && settings.default_path.value) {
			if (Blockbench.entity_mode) {
				var path = findEntityTexture(Project.parent, 'raw')
				if (path) {
					this.isDefault = true;
					path = settings.default_path.value + osfs + path

					if (fs.existsSync(path + '.png')) {
						this.fromPath(path + '.png')
						delete this.isDefault
						return true;

					} else if (fs.existsSync(path + '.tga')) {
						this.fromPath(path + '.tga')
						delete this.isDefault
						return true;
					}
					delete this.isDefault
				}
			} else if (this.name && this.name.includes('.')) {
				var folder = this.folder.replace(/\//g, osfs);
				var path = settings.default_path.value + osfs + (folder ? (folder+osfs) : '') + this.name
				if (fs.existsSync(path)) {
					this.isDefault = true;
					this.fromPath(path)
					return true;
				}
			}
		}
	}
	loadEmpty(error_id) {
		this.img.src = 'assets/missing.png'
		this.error = error_id||1;
		this.show_icon = false;
		return this;
	}
	updateSource(dataUrl) {
		this.source = dataUrl
		this.img.src = dataUrl
		this.updateMaterial()
		if (main_uv.texture === this) {
			main_uv.loadData()
		}
		if (open_dialog === 'uv_dialog') {
			for (var editor in uv_dialog.editors) {
				if (uv_dialog.editors.hasOwnProperty(editor) && uv_dialog.editors[editor].texture === this) {
					uv_dialog.editors[editor].loadData()
				}
			}
		}
		return this;
	}
	updateMaterial() {
		var scope = this;
		var img = new Image()
		try {
			img.src = scope.source
		} catch(err) {
		}
		img.onload = function() {
			Canvas.materials[scope.uuid].map.dispose()
			var tex = new THREE.Texture(img)
			img.tex = tex;
			img.tex.magFilter = THREE.NearestFilter
			img.tex.minFilter = THREE.NearestFilter
			img.tex.needsUpdate = true;
			scope.img = img
			Canvas.materials[scope.uuid].map = tex
		}
		return this;
	}
	reopen(force) {
		var scope = this;
		this.stopWatcher()

		function _replace() {
			Blockbench.import({
				extensions: ['png', 'tga'],
				type: 'PNG Texture',
				readtype: 'image',
				startpath: scope.path
			}, function(files) {
				scope.fromFile(files[0])

			})
			Painter.current = {}
			Blockbench.dispatchEvent( 'change_texture_path', {texture: scope} )
		}
		if (scope.saved || force) {
			_replace()
		} else {
			Blockbench.showMessageBox({
				translateKey: 'unsaved_texture',
				icon: 'warning',
				buttons: [tl('dialog.continue'), tl('dialog.cancel')],
				confirm: 0,
				cancel: 1
			}, function(result) {
				if (result === 0) {
					_replace()
				}
			})
		}
	}
	refresh(single) {
		if (this.mode === 'bitmap') {
			return false;
		}
		if (single) {
			tex_version++;
		}
		//this.source = this.path + '?' + tex_version;
		this.source = this.source.replace(/\?\d+$/, '?' + tex_version)
		this.load(undefined)
		TickUpdates.main_uv = true;
		TickUpdates.texture_list = true;
	}
	reloadTexture() {
		this.refresh(true)
	}
	startWatcher() {
		if (this.mode !== 'link' || !isApp || !this.path.match(/\.[a-zA-Z]+$/) || !fs.existsSync(this.path)) {
			return;
		}
		var scope = this;

		fs.watchFile(scope.path, {interval: 50}, function(curr, prev) {
			if (curr.mtime !== prev.mtime) {
				scope.reloadTexture()
			}
		})
	}
	stopWatcher() {
		if (this.mode !== 'link' || !isApp || !fs.existsSync(this.path)) {
			return;
		}
		fs.unwatchFile(this.path)
	}
	generateFolder(path) {
		var scope = this
		if (path.includes(osfs+'textures'+osfs)) {
			var arr = path.split(osfs+'textures'+osfs)

			var arr1 = arr[0].split(osfs)
			scope.namespace = arr1[arr1.length-1]

			var arr2 = arr[arr.length-1].split(osfs)
			arr2.pop()
			scope.folder = arr2.join('/')
		} else {
			var arr = path.split(osfs)
			scope.folder = arr[arr.length-2]
			if (Blockbench.entity_mode === false && isApp) {
				Blockbench.showMessageBox({
					translateKey: 'loose_texture',
					icon: 'folder_open',
					buttons: [tl('message.loose_texture.change'), tl('dialog.ok')],
					confirm: 0,
					cancel: 1
				}, function(result) {
					if (result === 0) {
						scope.reopen()
					}
				})
			}
		}
		return this;
	}
	//Management
	select(event) {
		textures.forEach(s => {
			if (s.selected) s.selected = false;
		})
		if (event) {
			Prop.active_panel = 'textures'
		}
		this.selected = true
		textures.selected = this
		return this;
	}
	add(undo) {
		if (undo) {
			Undo.initEdit({textures: []})
		}
		var scope = this
		if (!textures.includes(this)) {
			textures.push(this)
		}
		Blockbench.dispatchEvent( 'add_texture', {texture: this})
		loadTextureDraggable()

		if (Blockbench.entity_mode && elements.length) {
			var sides = ['north', 'east', 'south', 'west', 'up', 'down']
			elements.forEach(function(s) {
				sides.forEach(function(side) {
					s.faces[side].texture = scope.uuid
				})
			})
			Canvas.updateAllFaces()
			if (selected.length) {
				main_uv.loadData()
			}
			textures.forEach(function (t, i) {
				if (t !== scope) {
					textures.splice(i, 1)
				}
			})
		}
		if (undo) {
			Undo.finishEdit('add_texture', {textures: [this]})
		}
		return this;
	}
	remove(no_update) {
		if (!no_update) {
			Undo.initEdit({textures: [this]})
		}
		this.stopWatcher()
		textures.splice(textures.indexOf(this), 1)
		if (!no_update) {
			Canvas.updateAllFaces()
			$('#uv_frame').css('background', 'transparent')
			TextureAnimator.updateButton()
			hideDialog()
			BARS.updateConditions()
			Undo.finishEdit('remove_textures', {textures: []})
		}
	}
	//Use
	enableParticle() {
		textures.forEach(function(s) {
			s.particle = false;
		})
		if (!Blockbench.entity_mode) {
			this.particle = true
		}
		return this;
	}
	fillParticle() {
		var particle_tex = false
		textures.forEach(function(t) {
			if (t.particle) {
				particle_tex = t
			}
		})
		if (!particle_tex) {
			this.enableParticle()
		}
		return this;
	}
	apply(all) {
		if (selected.length === 0) return;
		var scope = this;
		Undo.initEdit({cubes: selected})

		selected.forEach(function(obj) {
			for (var face in obj.faces) {
				if (all || Blockbench.entity_mode || face === main_uv.face) {
					var f = obj.faces[face]
					if (all !== 'blank' || (f.texture !== null && !f.getTexture())) {
						f.texture = scope.uuid
					}
				}
			}
		})
		Canvas.updateSelectedFaces()
		main_uv.loadData()
		Undo.finishEdit('applied_texture')
		return this;
	}
	//Interface
	openFolder() {
		if (!isApp || !this.path) return this;
		if (!fs.existsSync(this.path)) {
			Blockbench.showQuickMessage('texture.error.file')
			return this;
		}
		shell.showItemInFolder(this.path)
		return this;
	}
	openEditor() {
		var scope = this;
		if (!settings.image_editor.value) {
			changeImageEditor(scope)

		} else {
			if (fs.existsSync(settings.image_editor.value)) {
				require('child_process').spawn(settings.image_editor.value, [this.path])
			} else {
				var answer = electron.dialog.showMessageBox(currentwindow, {
					type: 'info',
					noLink: true,
					title: tl('message.image_editor_missing.title'),
					message: tl('message.image_editor_missing.message'),
					detail: tl('message.image_editor_missing.detail')
				})
				selectImageEditorFile(scope)
			}
		}
		return this;
	}
	showContextMenu(event) {
		var scope = this;
		scope.select()
		this.menu.open(event, scope)
	}
	openMenu() {
		var scope = this
		scope.select()
		showDialog('texture_edit')

		if (scope.path) {
			var arr = scope.path.split(osfs)
			arr.splice(-1)
			var path = arr.join('<span class="slash">/</span>') + '<span class="slash">/</span><span class="accent_color">' + scope.name + '</span>'
			$('#texture_edit #te_path').html(path)
		} else {
			$('#texture_edit #te_path').html('')
		}

		$('#texture_edit #te_title').text(scope.name + ' ('+scope.img.naturalWidth+' x '+scope.img.naturalHeight+')')
		$('#texture_edit input#te_variable').val(scope.id)
		$('#texture_edit input#te_name').val(scope.name)
		$('#texture_edit input#te_folder').val(scope.folder)
		$('#texture_edit input#te_namespace').val(scope.namespace)
		$('#texture_menu_thumbnail').html(scope.img)

		if (scope.mode === 'link') {
			$('#texture_edit .tool.link_only').show()
			$('#texture_edit .tool.bitmap_only').hide()
		} else {
			$('#texture_edit .tool.link_only').hide()
			$('#texture_edit .tool.bitmap_only').show()
		}
	}
	//Export
	javaTextureLink() {
		var link = this.name.replace(/\.png$/, '')
		if (this.folder) {
			link = this.folder + '/' + link
		}
		if (this.namespace && this.namespace !== 'minecraft') {
			link = this.namespace + ':' + link
		}
		return link;
	}
	save(as) {
		var scope = this;
		if (scope.saved && !as) {
			return this;
		}

		if (isApp) {
			//overwrite path
			if (scope.mode === 'link') {
				var image = nativeImage.createFromPath(scope.source.replace(/\?\d+$/, '')).toPNG()
			} else {
				var image = nativeImage.createFromDataURL(scope.source).toPNG()
			}
			tex_version++;
			if (!as && this.path && this.path.substr(1,1) === ':') {
				fs.writeFile(this.path, image, function (err) {
					scope.fromPath(scope.path)
				})
			} else {
				var find_path;
				if (Blockbench.entity_mode) {
					find_path = findEntityTexture(Project.parent, true)
				}
				Blockbench.export({
					type: 'PNG Texture',
					extensions: ['png'],
					name: scope.name,
					content: image,
					startpath: find_path,
					savetype: 'image'
				}, function(path) {
					scope.fromPath(path)
				})
			}
		} else {
			//Download
			Blockbench.export({
				type: 'PNG Texture',
				extensions: ['png'],
				name: scope.name,
				content: scope.source,
				savetype: 'image'
			}, function() {
				scope.saved = true;
			})
		}
		return this;
	}
	getBase64() {
		var scope = this;
		if (isApp && scope.mode === 'link') {
			var canvas = document.createElement('canvas')
			canvas.width = scope.img.naturalWidth;
			canvas.height = scope.img.naturalHeight;
			var ctx = canvas.getContext('2d');
			ctx.drawImage(scope.img, 0, 0)
			var dataUrl = canvas.toDataURL('image/png')
		} else {
			var dataUrl = scope.source
		}
		return dataUrl.replace('data:image/png;base64,', '')
	}
	edit(cb, options) {
		var scope = this;
		if (!options) options = false;

		if (scope.mode === 'link') {
			scope.source = 'data:image/png;base64,' + scope.getBase64()
			scope.mode = 'bitmap'
			scope.saved = false
		}
		if (cb) {
			Painter.edit(scope, cb, options)
		}
		scope.saved = false;
	}
}
	Texture.prototype.menu = new Menu([
			{
				icon: 'crop_original',
				name: 'menu.texture.face', 
				condition: function() {return !Blockbench.entity_mode && selected.length > 0},
				click: function(texture) {texture.apply()}
			},
			{
				icon: 'texture',
				name: 'menu.texture.blank', 
				condition: function() {return !Blockbench.entity_mode && selected.length > 0},
				click: function(texture) {texture.apply('blank')}
			},
			{
				icon: 'fa-cube',
				name: 'menu.texture.cube',
				condition: function() {return !Blockbench.entity_mode && selected.length > 0},
				click: function(texture) {texture.apply(true)}
			},
			{
				icon: 'bubble_chart',
				name: 'menu.texture.particle',
				condition: function() {return !Blockbench.entity_mode},
				click: function(texture) {
					if (texture.particle) {
						texture.particle = false
					} else {
						texture.enableParticle()
					}
				}
			},
			'_',
			{
				icon: 'edit',
				name: 'menu.texture.edit',
				condition: function(texture) {return texture.mode == 'link'},
				click: function(texture) { texture.openEditor()}
			},
			{
				icon: 'folder',
				name: 'menu.texture.folder',
				condition: function(texture) {return isApp && texture.path},
				click: function(texture) {texture.openFolder()}
			},
			{
				icon: 'save',
				name: 'menu.texture.save',
				condition: function(texture) {return !texture.saved && texture.path},
				click: function(texture) {texture.save()}
			},
			{
				icon: 'file_download',
				name: 'menu.texture.export',
				click: function(texture) {texture.save(true)}
			},
			'_',
			{
				icon: 'refresh',
				name: 'menu.texture.refresh',
				condition: function(texture) {return texture.mode == 'link'},
				click: function(texture) {texture.reloadTexture()}
			},
			{
				icon: 'file_upload',
				name: 'menu.texture.change',
				click: function(texture) { texture.reopen()}
			},
			{
				icon: 'delete',
				name: 'generic.delete',
				click: function(texture) {
					Undo.initEdit({textures: [texture], bitmap: true})
					texture.remove()
					Undo.initEdit({textures: [], bitmap: true})
			}},
			'_',
			{
				icon: 'list',
				name: 'menu.texture.properties',
				click: function(texture) { texture.openMenu()}
			}
	])

function openTexture() {
	var start_path;
	if (!isApp) {} else
	if (textures.length > 0) {
		var arr = textures[0].path.split(osfs)
		arr.splice(-1)
		start_path = arr.join(osfs)
	} else if (Prop.file_path) {
		var arr = Prop.file_path.split(osfs)
		arr.splice(-3)
		arr.push('textures')
		start_path = arr.join(osfs)
	}
	Blockbench.import({
		readtype: 'image',
		type: 'PNG Texture',
		extensions: ['png', 'tga'],
		multiple: true,
		startpath: start_path
	}, function(results) {
		var new_textures = []
		Undo.initEdit({textures: new_textures})
		results.forEach(function(f) {
			var t = new Texture({name: f.name}).fromFile(f).add(false).fillParticle()
			new_textures.push(t)
		})
		Undo.finishEdit('add_texture')
	})
}
function reloadTextures() {
	tex_version++;
	textures.forEach(function(t) {
		if (t.mode === 'link') {
			t.source = t.path + '?' + tex_version;
			t.refresh(false)
		}
	})
	Canvas.updateAllFaces()
	main_uv.loadData()
	loadTextureDraggable()
}
function saveTextures() {
	textures.forEach(function(t) {
		if (!t.saved) {
			t.save()
		}
	})
}
function saveTextureMenu() {
	hideDialog()
	var tex = textures.selected

	var name = $('#texture_edit input#te_name').val(),
		id = $('#texture_edit input#te_variable').val(),
		folder = $('#texture_edit input#te_folder').val(),
		namespace = $('#texture_edit input#te_namespace').val();
		
	if (!(
		tex.name === name &&
		tex.id === id &&
		tex.folder === folder &&
		tex.namespace === namespace)
	) {
		Undo.initEdit({textures})
		tex.name = name;
		tex.id = id;
		tex.folder = folder;
		tex.namespace = namespace;
		Undo.finishEdit('texture_edit')
	}
}
function loadTextureDraggable() {
	Vue.nextTick(function() {
		setTimeout(function() {
			$('li.texture:not(.ui-draggable)').draggable({
				revertDuration: 0,
				helper: function(e) {
					var t = $(e.target)
					if (!t.hasClass('texture')) t = t.parent()
					if (!t.hasClass('texture')) t = t.parent()
					return t.find('.texture_icon_wrapper').clone().addClass('texture_drag_helper').attr('texid', t.attr('texid'))
				},
				cursorAt: { left: 2, top: -5 },
				revert: 'invalid',
				appendTo: 'body',
				zIndex: 19,
				distance: 4,
				drag: function(event, ui) {
					$('.outliner_node[order]').attr('order', null)
					var tar = $('#cubes_list li .drag_hover.outliner_node').deepest()
					var element = TreeElements.findRecursive('uuid', tar.attr('id'))
					if (element) {
						tar.attr('order', '0')
					}
				},
				stop: function(event, ui) {
					setTimeout(function() {
						if ($('canvas.preview:hover').length > 0) {
							var data = Canvas.getCurrentPreview().raycast()
							if (data.cube && data.face) {
								var tex = textures.findInArray('uuid', ui.helper.attr('texid'));
								var cubes_list = data.cube.selected ? selected : [data.cube];
								Undo.initEdit({cubes: cubes_list})
								if (tex) {
									cubes_list.forEach(cube => {
										cube.applyTexture(tex, [data.face])
									})
								}
								Undo.finishEdit('apply texture')
							}
						}
					}, 10)
				}
			})
		}, 42)
	})
}
function unselectTextures() {
	textures.forEach(function(s) {
		s.selected = false;
	})
	textures.selected = false
}
function changeTexturesFolder() {
	var path = undefined;
	var i = 0;
	while (i < textures.length && path === undefined) {
		if (typeof textures[i].path == 'string' && textures[i].path.length > 8) {
			path = textures[i].path
		}
		i++;
	}
	if (!path) {return;}

	var path = path.split(osfs)
	path.splice(-1)
	path = path.join(osfs)

	 electron.dialog.showOpenDialog(currentwindow, {
		title: tl('message.default_textures.select'),
		properties: ['openDirectory'],
		defaultPath: path
	}, function(filePaths) {
		if (filePaths && filePaths.length) {
			var new_path = filePaths[0]
			Undo.initEdit({textures})
			textures.forEach(function(t) {
				if (typeof t.path === 'string' && t.path.includes(path)) {
					t.fromPath(t.path.replace(path, new_path))
				} 
			})
			Undo.finishEdit('folder_changed')
		}
	})

}
function getTextureById(id) {
	if (id === undefined || id === false) return;
	if (id == null) {
		return {material: transparentMaterial};
	}
	id = id.replace('#', '');
	return $.grep(textures, function(e) {return e.id == id})[0];
}
function getTexturesById(id) {
	if (id === undefined) return;
	id = id.replace('#', '');
	return $.grep(textures, function(e) {return e.id == id});
}

TextureAnimator = {
	isPlaying: false,
	interval: false,
	start: function() {
		clearInterval(TextureAnimator.interval)
		TextureAnimator.isPlaying = true
		TextureAnimator.updateButton()
		TextureAnimator.interval = setInterval(TextureAnimator.nextFrame, 1000/settings.texture_fps.value)
	},
	stop: function() {
		TextureAnimator.isPlaying = false
		clearInterval(TextureAnimator.interval)
		TextureAnimator.updateButton()
	},
	toggle: function() {
		if (TextureAnimator.isPlaying) {
			TextureAnimator.stop()
		} else {
			TextureAnimator.start()
		}
	},
	updateSpeed: function() {
		if (TextureAnimator.isPlaying) {
			TextureAnimator.stop()
			TextureAnimator.start()
		}
	},
	nextFrame: function() {
		var animated_tex = []
		textures.forEach(function(tex, i) {
			if (tex.frameCount > 1) {
				if (tex.currentFrame === undefined) {
					tex.currentFrame = 0
				} else if (tex.currentFrame >= tex.frameCount-1) {
					tex.currentFrame = 0
				} else {
					tex.currentFrame++;
				}
				$($('.texture').get(i)).find('img').css('margin-top', (tex.currentFrame*-48)+'px')
				animated_tex.push(tex)
			}
		})
		elements.forEach(function(obj) {
			var update = false
			for (var face in obj.faces) {
				update = update || animated_tex.includes(obj.faces[face].getTexture());
			}
			if (update) {
				Canvas.updateUV(obj, true)
			}
		})
	},
	reset: function() {
		TextureAnimator.stop()
		textures.forEach(function(tex, i) {
			if (tex.frameCount) {
				tex.currentFrame = 0
				$($('.texture').get(i)).find('img').css('margin-top', '0')
			} 
		})
		while (i < elements.length) {
			Canvas.updateUV(elements[i], true)
			i++;
		}
	},
	updateButton: function() {
		BarItems.animated_textures.setIcon( TextureAnimator.isPlaying ? 'pause' : 'play_arrow' )
	}
}

onVueSetup(function() {
	texturelist = new Vue({
		el: '#texture_list',
		data: {textures}
	})
	texturelist._data.elements = textures
})

BARS.defineActions(function() {
	new Action({
		id: 'import_texture',
		icon: 'library_add',
		category: 'textures',
		keybind: new Keybind({key: 84, ctrl: true}),
		click: function () {
			openTexture()
		}
	})
	new Action({
		id: 'create_texture',
		icon: 'icon-create_bitmap',
		category: 'textures',
		keybind: new Keybind({key: 84, ctrl: true, shift: true}),
		click: function () {
			Painter.addBitmapDialog()
		}
	})
	new Action({
		id: 'reload_textures',
		icon: 'refresh',
		category: 'textures',
		keybind: new Keybind({key: 82, ctrl: true}),
		condition: isApp,
		click: reloadTextures
	})
	new Action({
		id: 'save_textures',
		icon: 'save',
		category: 'textures',
		keybind: new Keybind({key: 83, ctrl: true, alt: true}),
		click: function () {saveTextures()}
	})
	new Action({
		id: 'change_textures_folder',
		icon: 'fa-hdd-o',
		category: 'textures',
		condition: () => textures.length > 0,
		click: function () {changeTexturesFolder()}
	})
	new Action({
		id: 'animated_textures',
		icon: 'play_arrow',
		category: 'textures',
		condition: function() {
			if (Blockbench.entity_mode) return false;
			var i = 0;
			var show = false;
			while (i < textures.length) {
				if (textures[i].frameCount > 1) {
					show = true;
					i = textures.length
				}
				i++;
			}
			return show;
		},
		click: function () {
			TextureAnimator.toggle()
		}
	})
})
