function runTest(config,qualifier) {

    var testname = testnamePrefix(qualifier, config.keysystem)
                                    + ', temporary, '
                                    + /video\/([^;]*)/.exec(config.videoType)[1]
                                    + ', playback with multiple keys and sessions, '
                                    + config.testcase;

    var configuration = {   initDataTypes: [ config.initDataType ],
                            audioCapabilities: [ { contentType: config.audioType } ],
                            videoCapabilities: [ { contentType: config.videoType } ],
                            sessionTypes: [ 'temporary' ] };

    async_test(function(test) {

        var _video = config.video,
            _mediaKeys,
            _mediaKeySessions = [];

        function onFailure(error) {
            forceTestFailureFromPromise(test, error);
        }

        function onMessage(event) {
            consoleWrite("message " + event.messageType);
            assert_any(assert_equals, event.target, _mediaKeySessions);
            assert_true(event instanceof window.MediaKeyMessageEvent);
            assert_equals(event.type, 'message');
            assert_in_array(event.messageType, ['license-request', 'individualization-request']);

            config.messagehandler(event.messageType, event.message, {variantId: event.target._variantId}).then(function(response) {
                return event.target.update(response);
            }).catch(onFailure);
        }

        function onWaitingForKey(event) {
            consoleWrite("waitingforkey");
        }

        function onPlaying(event) {
            consoleWrite("playing");
            waitForEventAndRunStep('pause', _video, onStopped, test);
            waitForEventAndRunStep('waiting', _video, onStopped, test);
            waitForEventAndRunStep('stalled', _video, onStopped, test);
        }

        function onStopped(event) {
            consoleWrite( event.type );
            if (_mediaKeySessions.length < config.initData.length) {
                var mediaKeySession = _mediaKeys.createSession('temporary');
                waitForEventAndRunStep('message', mediaKeySession, onMessage, test);
                mediaKeySession._variantId = config.variantIds ? config.variantIds[_mediaKeySessions.length] : undefined;
                mediaKeySession.generateRequest(config.initDataType, config.initData[_mediaKeySessions.length]).catch(onFailure);
                _mediaKeySessions.push(mediaKeySession);
            }
        }

        function onTimeupdate(event) {
            if ( _video.currentTime > (config.duration || 1)) {
                _video.removeEventListener('timeupdate', onTimeupdate);
                _video.pause();
                test.done();
            }
        }

        navigator.requestMediaKeySystemAccess(config.keysystem, [configuration]).then(function(access) {
            return access.createMediaKeys();
        }).then(function(mediaKeys) {
            _mediaKeys = mediaKeys;
            return _video.setMediaKeys(_mediaKeys);
        }).then(function(){
            waitForEventAndRunStep('waitingforkey', _video, onWaitingForKey, test);
            waitForEventAndRunStep('playing', _video, onPlaying, test);

            // Not using waitForEventAndRunStep() to avoid too many
            // EVENT(onTimeUpdate) logs.
            _video.addEventListener('timeupdate', onTimeupdate, true);

            var mediaKeySession = _mediaKeys.createSession('temporary');
            waitForEventAndRunStep('message', mediaKeySession, onMessage, test);
            _mediaKeySessions.push(mediaKeySession);
            mediaKeySession._variantId = config.variantIds ? config.variantIds[0] : undefined;
            return mediaKeySession.generateRequest(config.initDataType, config.initData[0]);
        }).then(function() {
            return testmediasource(config);
        }).then(function(source) {
            _video.src = URL.createObjectURL(source);
            return source.done;
        }).then(function(){
            _video.play();
        }).catch(onFailure);
    }, testname);
}
