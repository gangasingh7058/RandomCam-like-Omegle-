import { useEffect, useRef, useState } from "react";
import { Phone, RotateCcw, Video as VideoIcon, VideoOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

const VideoConferencePage = () => {
  const navigate = useNavigate();

  // --- State variables ---
  const [socket, setSocket] = useState(null);
  const [peer, setPeer] = useState(null);
  const [othersideId, setOthersideId] = useState(null);
  const [sdp, setsdp] = useState(null);
  const [conneciondone, setconnectiondone] = useState(false);

  const [isConnected, setIsConnected] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);

  // live-user-count
  const [liveusercount, setliveusercount] = useState(0);

  // --- Refs ---
  const localvideo = useRef();
  const remotevideo = useRef();

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

    const newPeer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    setTimeout(() => {
      socket.send(JSON.stringify({ type: "new-user" }));
    }, 1000);

    newPeer.onnegotiationneeded = async () => {
      const temp_sdp = await newPeer.createOffer();
      await newPeer.setLocalDescription(temp_sdp);
      setsdp(temp_sdp);
    };

    const iceCandidateQueue = [];

    newPeer.onicecandidate = (event) => {
      if (!event.candidate) return;

      if (othersideId != null) {
        socket.send(
          JSON.stringify({
            type: "ice-connection",
            iceconnections: event.candidate,
            otherside: othersideId,
          })
        );
      } else {
        iceCandidateQueue.push(event.candidate);
      }
    };

    const sendQueuedCandidates = () => {
      iceCandidateQueue.forEach((candidate) => {
        socket.send(
          JSON.stringify({
            type: "onice-connection",
            iceconnections: candidate,
            otherside: othersideId,
          })
        );
      });
      iceCandidateQueue.length = 0;
    };

    newPeer.ontrack = (event) => {
      setIsConnected(true);
      if (remotevideo.current) {
        remotevideo.current.srcObject = event.streams[0];
      } else {
        alert("Error fetching remote video");
      }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (localvideo.current) {
        localvideo.current.srcObject = stream;
      }
      stream.getTracks().forEach((track) => newPeer.addTrack(track, stream));
    } catch (err) {
      console.error("Error getting local media:", err);
    }

    socket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      console.log(data);

      if (data.type === "send-offer") {
        setOthersideId(data.otherside);
        const offer = await newPeer.createOffer();
        await newPeer.setLocalDescription(offer);
        socket.send(
          JSON.stringify({ type: "offer", sdp: offer, otherside: data.otherside })
        );
      }

      if (data.type === "send-answer") {
        setOthersideId(data.otherside);
        setTimeout(sendQueuedCandidates, 10);
        await newPeer.setRemoteDescription(data.sdp);
        const answer = await newPeer.createAnswer();
        await newPeer.setLocalDescription(answer);
        socket.send(
          JSON.stringify({ type: "answer", sdp: answer, otherside: data.otherside })
        );
      }

      if (data.type === "other-side-answer") {
        setTimeout(sendQueuedCandidates, 10);
        await newPeer.setRemoteDescription(data.sdp);
      }

      if (data.type === "ice-connection") {
        try {
          await newPeer.addIceCandidate(new RTCIceCandidate(data.iceconnections));
        } catch (err) {
          console.error("Error adding ICE candidate:", err);
        }
      }

      if (data.type === "other-did-next" || data.type === "partner-disconnected") {
        resetRemoteVideo(true);
      }

      if (data.type === "user-count") {
        setliveusercount(data.count);
      }
    };

    setPeer(newPeer);
  };

  const connectnewcaller = () => {
    socket.send(JSON.stringify({ type: "next" }));
    resetRemoteVideo(false);
  };

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

  const handleEndCall = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close();
    }
    console.log("ws connection closed");
    setSocket(null);

    if (remotevideo.current?.srcObject) {
      remotevideo.current.srcObject.getTracks().forEach((track) => track.stop());
      remotevideo.current.srcObject = null;
    }

    if (localvideo.current?.srcObject) {
      localvideo.current.srcObject.getTracks().forEach((track) => track.stop());
      localvideo.current.srcObject = null;
    }

    if (peer) {
      peer.getSenders().forEach((sender) => sender.track && sender.track.stop());
      peer.close();
      setPeer(null);
    }

    setIsConnected(false);
    setOthersideId(null);
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">

        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">
            {isConnected ? "✅ Connected" : "❌ Not Connected"}
          </h2>
          <div className="flex gap-4 items-center">
            <div className="flex items-center font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-lg">
              👥 Live: {liveusercount}
            </div>
            <button
              onClick={handleEndCall}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg shadow-md transition"
            >
              <Phone className="w-4 h-4" /> End Call
            </button>
          </div>
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-gray-100">
          {/* Local Video */}
          <div className="bg-black rounded-xl overflow-hidden relative shadow-md">
            <video
              ref={localvideo}
              id="localVideo"
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {!isVideoOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
                <VideoOff className="w-10 h-10 mb-2" />
                Camera Off
              </div>
            )}
          </div>

          {/* Remote Video */}
          <div className="bg-transparent rounded-xl overflow-hidden relative shadow-md">
            <video
              ref={remotevideo}
              id="remoteVideo"
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {!isConnected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
                <VideoOff className="w-10 h-10 mb-2 animate-pulse" />
                Waiting for connection...
              </div>
            )}
          </div>
        </div>

        {/* Connection Status */}
        <div className="text-center py-3 text-gray-700 font-medium bg-gray-50 border-t">
          {othersideId == null ? "🔄 Connecting to Others..." : "🎉 Guest Connected"}
        </div>

        {/* Controls */}
        <div className="p-6 flex justify-center gap-6 bg-white border-t">
          {!conneciondone && (
            <button
              onClick={() => {
                setconnectiondone(true);
                connectUser();
              }}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl shadow-md font-medium transition"
            >
              Connect
            </button>
          )}

          {conneciondone && (
            <button
              disabled={!othersideId}
              onClick={connectnewcaller}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-xl shadow-md font-medium transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {othersideId == null ? "Connecting..." : "Next"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoConferencePage;
