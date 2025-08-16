import { useEffect, useRef, useState } from "react";
import { Phone, RotateCcw, Video as VideoIcon, VideoOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

const VideoConferencePage = () => {

  const navigate = useNavigate();

  // --- State variables ---
  const [socket, setSocket] = useState(null);             // WebSocket connection
  const [peer, setPeer] = useState(null);                 // RTCPeerConnection
  const [othersideId, setOthersideId] = useState(null);   // ID of the other user
  const [sdp, setsdp] = useState(null);                   // Local SDP
  const [conneciondone, setconnectiondone] = useState(false); // Tracks if initial connection is done

  const [isConnected, setIsConnected] = useState(false);  // Remote connection status
  const [isVideoOn, setIsVideoOn] = useState(true);       // Local video status

  // --- Refs ---
  const localvideo = useRef();   // Local video element
  const remotevideo = useRef();  // Remote video element

  // --- Setup WebSocket ---
  useEffect(() => {
    const setup_socket = () => {
      const ws = new WebSocket(`${import.meta.env.VITE_WEBSOCKET_ROUTE}`);

      ws.onopen = () => console.log("Connected to WS server");
      ws.onclose = () => console.log("Disconnected from WS");
      ws.onerror = (err) => console.error("WebSocket error:", err);

      setSocket(ws);
    };

    setup_socket();

    return () => {
      socket?.close();
    };
  }, []);

  // --- Connect or re-connect user ---
  const connectUser = async () => {
    if (!socket || socket.readyState === WebSocket.CLOSED) return;

    // Notify server a new user joined
    socket.send(JSON.stringify({ type: "new-user" }));

    const newPeer = new RTCPeerConnection();

    // Trigger SDP offer when negotiation is needed
    newPeer.onnegotiationneeded = async () => {
      const temp_sdp = await newPeer.createOffer();
      await newPeer.setLocalDescription(temp_sdp);
      setsdp(temp_sdp);
    };

    // Queue for ICE candidates until other side is ready
    const iceCandidateQueue = [];

    // Handle ICE candidates
    newPeer.onicecandidate = (event) => {
      if (!event.candidate) return;

      if (othersideId != null) {
        // Peer is ready → send immediately
        socket.send(JSON.stringify({
          type: "ice-connection",
          iceconnections: event.candidate,
          otherside: othersideId,
        }));
      } else {
        // Peer not ready → queue it
        iceCandidateQueue.push(event.candidate);
      }
    };

    // Send queued ICE candidates once other side is ready
    const sendQueuedCandidates = () => {
      iceCandidateQueue.forEach(candidate => {
        socket.send(JSON.stringify({
          type: "ice-connection",
          iceconnections: candidate,
          otherside: othersideId,
        }));
      });
      iceCandidateQueue.length = 0; // Clear queue
    };

    // Display remote stream
    newPeer.ontrack = (event) => {
      if (remotevideo.current) {
        remotevideo.current.srcObject = event.streams[0];
      }
    };

    // Get local stream and attach to peer
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (localvideo.current) {
        localvideo.current.srcObject = stream;
      }
      stream.getTracks().forEach((track) => newPeer.addTrack(track, stream));
      setIsConnected(true);
    } catch (err) {
      console.error("Error getting local media:", err);
    }

    // --- WebSocket message handling ---
    socket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      console.log(data);

      // Received offer from other user
      if (data.type === "send-offer") {
        setOthersideId(data.otherside);
        setTimeout(sendQueuedCandidates, 1);
        const offer = await newPeer.createOffer();
        await newPeer.setLocalDescription(offer);
        socket.send(JSON.stringify({ type: "offer", sdp: offer, otherside: data.otherside }));
      }

      // Received answer from other user
      if (data.type === "send-answer") {
        setOthersideId(data.otherside);
        setTimeout(sendQueuedCandidates, 1);
        await newPeer.setRemoteDescription(data.sdp);
        const answer = await newPeer.createAnswer();
        await newPeer.setLocalDescription(answer);
        socket.send(JSON.stringify({ type: "answer", sdp: answer, otherside: data.otherside }));
      }

      // Final answer from other side
      if (data.type === "other-side-answer") {
        setTimeout(sendQueuedCandidates, 1);
        await newPeer.setRemoteDescription(data.sdp);
      }

      // Incoming ICE candidate
      if (data.type === "ice-connection") {
        try {
          await newPeer.addIceCandidate(new RTCIceCandidate(data.iceconnections));
        } catch (err) {
          console.error("Error adding ICE candidate:", err);
        }
      }

      // Handle next / disconnect events
      if (data.type === "other-did-next" || data.type === "partner-disconnected") {
        resetRemoteVideo(true);
      }
    };

    setPeer(newPeer);
  };

  // --- Connect next caller ---
  const connectnewcaller = () => {
    socket.send(JSON.stringify({ type: "next" }));
    resetRemoteVideo(false);
  };

  // --- Reset remote video & optionally reconnect ---
  const resetRemoteVideo = (other_disconnected = false) => {
    if (remotevideo.current?.srcObject) {
      remotevideo.current.srcObject.getTracks().forEach((track) => track.stop());
      remotevideo.current.srcObject = null;
    }
    setIsConnected(false);
    setOthersideId(null);

    setTimeout(() => {
      if (!other_disconnected) {
        setTimeout(() => {
          connectUser();
        }, 3000);
      } else {
        connectUser();
      }
    }, 1);
  };

  // --- End call and cleanup ---
  const handleEndCall = () => {

    // Close WebSocket if open
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close();
    }
    console.log("ws connection closed");
    setSocket(null);

    // Stop remote video
    if (remotevideo.current?.srcObject) {
      remotevideo.current.srcObject.getTracks().forEach(track => track.stop());
      remotevideo.current.srcObject = null;
    }

    // Stop local video & mic
    if (localvideo.current?.srcObject) {
      localvideo.current.srcObject.getTracks().forEach(track => track.stop());
      localvideo.current.srcObject = null;
    }

    // Close RTCPeerConnection
    if (peer) {
      peer.getSenders().forEach(sender => sender.track && sender.track.stop());
      peer.close();
      setPeer(null);
    }

    setIsConnected(false);

    // Navigate to home page
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-6xl bg-white rounded-xl shadow-lg overflow-hidden">

        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">
            {isConnected ? "Connected" : "Not Connected"}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handleEndCall}
              className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-md"
            >
              <Phone className="w-4 h-4" /> End Call
            </button>
            <button
              onClick={connectnewcaller}
              className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-md"
            >
              <RotateCcw className="w-4 h-4" /> Next
            </button>
          </div>
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-100">

          {/* Local Video */}
          <div className="bg-black rounded-lg overflow-hidden relative">
            <video
              ref={localvideo}
              id="localVideo"
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {!isVideoOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white">
                <VideoOff className="w-10 h-10 mb-2" />
                Camera off
              </div>
            )}
          </div>

          {/* Remote Video */}
          <div className="bg-black rounded-lg overflow-hidden relative">
            <video
              ref={remotevideo}
              id="remoteVideo"
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {!isConnected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white">
                <VideoOff className="w-10 h-10 mb-2" />
                Waiting for connection...
              </div>
            )}
          </div>

        </div>

        {/* Controls */}
        <div className="p-4 border-t flex justify-center gap-4">

          {!conneciondone && (
            <button
              onClick={() => {
                setconnectiondone(true);
                connectUser();
              }}
              
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md"
            >
              Connect
            </button>
          )}

          {conneciondone && (
              <button
                disabled={!othersideId}
                onClick={connectnewcaller}
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md disabled:bg-gray-600"
              >
                {othersideId==null?'Connecting ...':'NEXT'}
              </button>
          )}
          
        </div>
      </div>
    </div>
  );
};

export default VideoConferencePage;
