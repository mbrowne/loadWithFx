(function() {
	if (typeof define == 'function' && define.amd) {
		define( ['jquery'], function($) { moduleDefinition($); return $.loadWithFx; } );
	}
	else moduleDefinition(jQuery);
	
	function moduleDefinition($) {
	
		var requestPendingFor = [],
			ajaxResponseCache = {};
		
		var defaults = {
			url: null,
			urlParams: null,
			complete: null,
			fxOut: 'fadeOut',
			fxIn: 'fadeIn',
			crossFade: true,
			ajaxErrorMsg: '(The requested resource could not be loaded.)',
			cacheResponse: false
		};
		
		$.fn.loadWithFx = function() {		
			//TODO: Make it so that only one ajax request goes out, then all the selected elements
			//are updated with that HTML (if there are multiple elements that should all be loaded with the same content)
			if ($(this).length > 1) {
				throw new Error("jQuery.fn.loadWithFx currently only supports being called on a single element");
			}
			
			//this.each(function() {
				var instance = $(this).data('loadWithFx');
				if (!instance) {
					instance = new LoadWithFx(this);
					$(this).data('loadWithFx', instance);
				}
				instance.fnPlugin.apply(instance, arguments);
			//});
			return this;
		}
		
		$.loadWithFx = LoadWithFx;
		
		var DEBUG = $.loadWithFx.DEBUG = false,
			log, logFx;
		
		function LoadWithFx(el) {
			this.$el = $(el);
			this.options = {};
			this.$divNewContents = null;
			this.$divOldContents = null;
			this.elPrevPosition = null;
			
			DEBUG = $.loadWithFx.DEBUG;
			if (DEBUG) initDebug();
		}
		
		LoadWithFx.prototype = {
			constructor: LoadWithFx,
			
			//Recommended usage when triggered by a user action:
			//$('#myActionButton').one('click', function() {
			//	$('#myDiv').loadWithFx(url, ...);
			//});
			//
			//The use of the 'one' method prevents an unnecessary AJAX request if the user were to
			//(perhaps accidentally) click the #myActionButton again.
			//
			//In some cases you may want to be able to reload the same content back into an element
			//more than once (tabs come to mind) but unless the data returned from the server is constantly
			//changing and needs to be real-time, then it would be best to set cacheResponse = true
			//
			//default values:
			//fxOut= 'fadeOut'
			//fxIn = 'fadeIn'
			//crossFade = true (this just means simultaneous animation, regardless of whether it's a fade or some other animation)
			//cacheResponse = false
			//	Not to be confused with the cache option passed to $.ajax, which only works if the headers from the server
			//	allow caching.
			//	This is in-memory caching of the HTML returned
			//
			fnPlugin: function(url, urlParams, complete, fxOut, fxIn, crossFade, ajaxErrorMsg, cacheResponse) {
				
				var $el = this.$el;
				
				var options = {};
				if (arguments.length>1 || typeof arguments[0]=='string') {
					//Method 1: ordered arguments
					var optionKeys = Object.keys(defaults);
					for (var i in arguments) {
						if (arguments[i] != null) options[optionKeys[i]] = arguments[i];
					}
				}
				else {
					//Method 2: pass in an options object
					options = arguments[0];
				}
				
				options = this.options = $.extend({}, defaults, options);
				
				this.validateOptions();			
					
				//TODO - caching, in case the same remote HTML needs to be loaded into the same div more than once
				//(e.g. if something else had been put there in between the two times)		
				var $divOldContents, $divNewContents;
				
				//prevent simultaneous AJAX requests for the same URL
				if (requestPendingFor[options.url]) return;
				requestPendingFor[options.url] = true;
				
				var fxOut = options.fxOut;
				if (fxOut instanceof Array) {
					var args = fxOut.slice(1);
					fxOut = fxOut[0];
				}
				else var args = [];
				
				//Crossfade doesn't make sense if fade-out happens immediately
				if (fxOut=='hide') options.crossFade = false;
				
				if (options.crossFade) {
					this.$divOldContents = $('<div style="position:absolute;width:100%;"/>');
					
					this.$divOldContents.append( $el.contents() );
					
					this.elPrevPosition = $el.css('position');
					$el.css('position', 'relative').empty().append( this.$divOldContents );
				}
				else {
					$el.hide();
					this.$divOldContents = $el;
				}
				
				if (DEBUG) logFx(fxOut, args);
				
				var fxOutFunc = (typeof fxOut=='function' ? fxOut: $.fn[fxOut]);
				fxOutFunc.apply(this.$divOldContents, args);
				
				if (options.cacheResponse) {
					var html;
					if (html = ajaxResponseCache[options.url]) {
						if (DEBUG) log('Retrieving HTML from cache');
						this.ajax_success(html);
						return;
					}
				}
				
				var self = this;
				
				//Note that $.get returns a jqXHR, not an XMLHttpRequest object like $.load
				//This is because $.get supports JSONP
				$.ajax({
					url: options.url,
				
					data: options.urlParams,
					
					//TODO: Create an ajaxSettings option that gets merged with these settings
					//so that properties like this can be customized
					cache: true,
					
					success: function() { self.ajax_success.apply(self, arguments); },
					
					error: function() {
						$el.html(ajaxErrorMsg);
						requestPendingFor[options.url] = false;
					},
					
					complete: function(html, textStatus, jqXHR) {
						if (typeof options.complete=='function') options.complete(html, textStatus, jqXHR);
					}
				});
			},
			
			validateOptions: function() {
				if (DEBUG) {
					log('options:');
					log(this.options);
				}
				var options = this.options;
				this.validateFx(options.fxIn, 'In');
				this.validateFx(options.fxOut, 'Out');
			},
			
			validateFx: function(fx, inOrOut) {
				if (fx instanceof Array) fx = fx[0];
				if (typeof fx!='function' && typeof $.fn[fx]!='function') {
					throw new Error('loadWithFx: invalid animation function name "'+fx+'"');
				}
			},
		
			ajax_success: function(html, textStatus, jqXHR) {
				var self = this;
				var options = this.options;
							
				if (options.crossFade) {
					this.$divNewContents = $('<div style="position:absolute;width:100%;display:none;"/>')
						.appendTo(this.$el);
				}
				else {
					this.$divNewContents = this.$el;
					
					//hide old element(s) immediately
					if (DEBUG) {
						log("Stopping fxOut animation (if it hasn't already completed)");
					}
					this.$divOldContents.hide();
				}
				
				this.$divNewContents.html(html);
				
				var fxIn = options.fxIn;
				if (fxIn instanceof Array) {
					var args = fxIn.slice(1);
					fxIn = fxIn[0];
				}
				
				var fxInFunc = (typeof fxIn=='function' ? fxIn: $.fn[fxIn]);
				var fxInCallbackArgIndex = fxInFunc.length - 1;
				
				if (args) {				
					//We assume that 'callback' is the last parameter of the effect function
					if (providedFxInCallback = args[fxInCallbackArgIndex]) {
						var orig_fxIn_complete = this.fxIn_complete;
						this.fxIn_complete = function() {
							providedFxInCallback.call(this);
							orig_fxIn_complete.call(self);
						}
					}
					for (var i=0; i<fxInCallbackArgIndex; i++) {
						if (typeof args[i]=='undefined') args[i] = null;
					}
				}
				else {
					var args = [];
					for (var i=0; i<fxInCallbackArgIndex; i++) args[i] = null;
				}
				
				args[fxInCallbackArgIndex] = $.proxy(self.fxIn_complete, self);
				
				if (DEBUG) logFx(fxIn, args);
				
				fxInFunc.apply(this.$divNewContents, args);
				
				if (options.cacheResponse) {
					//cache HTML for this URL for next time
					ajaxResponseCache[options.url] = html;
				}
			},
			
			fxIn_complete: function() {
				var options = this.options;
			
				if (options.crossFade) {
					//clean up
					this.$divOldContents.remove();
					this.$el.css('position', this.elPrevPosition).prepend(this.$divNewContents.contents());
					this.$divNewContents.remove();
				}
				
				requestPendingFor[options.url] = false;
			}
		};
		
		function initDebug() {
			log = console.log;
			logFx = function(fx, args) {
				log('Doing '+fx + '; arguments:');
				log(args);
			}
		}
		
		//Backwards compatibility
		if (!Object.keys) {
		  Object.keys = (function () {
			var hasOwnProperty = Object.prototype.hasOwnProperty,
				hasDontEnumBug = !({toString: null}).propertyIsEnumerable('toString'),
				dontEnums = [
				  'toString',
				  'toLocaleString',
				  'valueOf',
				  'hasOwnProperty',
				  'isPrototypeOf',
				  'propertyIsEnumerable',
				  'constructor'
				],
				dontEnumsLength = dontEnums.length
		 
			return function (obj) {
			  if (typeof obj !== 'object' && typeof obj !== 'function' || obj === null) throw new TypeError('Object.keys called on non-object')
		 
			  var result = []
		 
			  for (var prop in obj) {
				if (hasOwnProperty.call(obj, prop)) result.push(prop)
			  }
		 
			  if (hasDontEnumBug) {
				for (var i=0; i < dontEnumsLength; i++) {
				  if (hasOwnProperty.call(obj, dontEnums[i])) result.push(dontEnums[i])
				}
			  }
			  return result
			}
		  })()
		};
	}
})();