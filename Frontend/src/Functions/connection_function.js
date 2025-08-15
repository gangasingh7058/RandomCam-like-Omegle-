export const connectUser = async (socket,localvideo,remotevideo,setsdp,othe) => {
    if (!socket) return;

    socket.send(JSON.stringify({ type: "new-user" })); // register yourself

    const newPeer = new RTCPeerConnection();

    newPeer.onnegotiationneeded=async ()=>{
        const temp_sdp=await newPeer.createOffer();
        newPeer.setLocalDescription(temp_sdp);
        setsdp(temp_sdp);
    }

    // Send ICE candidates to server
    newPeer.onicecandidate = (event) => {
      if(othersideId==null){
        setTimeout(()=>{
        },1000)
      }
      else if (event.candidate && othersideId) {
        socket.send(
          JSON.stringify({
            type: "onice-connection",
            iceconnections: event.candidate,
            otherside: othersideId,
          })
        );
      }
    };

    // Remote track handling
    newPeer.ontrack = (event) => {
      if (remotevideo) {
        remotevideo.srcObject = event.streams[0];
      }
    };

    // Get local media
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (localvideo) {
        localvideo.srcObject = stream;
      }

      stream.getTracks().forEach((track) => newPeer.addTrack(track, stream));
    } catch (err) {
      console.error("Error getting local media:", err);
    }

    // WebSocket message handling
    socket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      console.log("Message from server:");
      console.log(data);
      

      // Server tells you to start offer
            if (data.type === "send-offer") {
            setOthersideId(data.otherside);

            const offer = await newPeer.createOffer();
            await newPeer.setLocalDescription(offer);
            
                console.log(offer);
                

            socket.send(
                JSON.stringify({
                type: "offer",
                sdp: offer,
                otherside: data.otherside,
                })
            );
        }


      // You received an offer — create an answer
      if (data.type === "send-answer") {
        setOthersideId(data.otherside);
        await newPeer.setRemoteDescription(data.sdp);
        const answer = await newPeer.createAnswer();
        await newPeer.setLocalDescription(answer);
        socket.send(
          JSON.stringify({
            type: "answer",
            sdp: answer,
            otherside: data.otherside,
          })
        );
      }

      // You received the final answer to your offer
      if (data.type === "other-side-answer") {
        await newPeer.setRemoteDescription(data.sdp);
      }

      // ICE candidate from other peer
      if (data.type === "ice-connection") {
        try {
          await newPeer.addIceCandidate(new RTCIceCandidate(data.iceconnections));
        } catch (err) {
          console.error("Error adding ICE candidate:", err);
        }
      }

      if(data.type === 'other-did-next' || data.type === 'partner-disconnected'){
        resetRemoteVideo(true);
      }
    };

    setPeer(newPeer);
  };