import { Video, Shield, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

const LandingPage = () => {

   const navigate=useNavigate(); 

  const featurelist = [
    {
      icon: <Video className="w-8 h-8 text-indigo-500" />,
      title: "Instant Video",
      description:
        "Start video conversations immediately with people from around the globe.",
    },
    {
      icon: <Shield className="w-8 h-8 text-emerald-500" />,
      title: "Anonymous",
      description:
        "Video chat safely without revealing your identity or personal information.",
    },
    {
      icon: <Users className="w-8 h-8 text-pink-500" />,
      title: "Global Community",
      description:
        "Connect with diverse people and experience different cultures.",
    },
  ];


  const handlestartvideo=()=>{
    navigate('/video-conference')
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-20 space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">
          CONNECT
        </h1>
        <h2 className="text-2xl md:text-3xl font-medium text-gray-700">
          Video Chat with Strangers
        </h2>
        <p className="max-w-2xl text-gray-500 leading-relaxed">
          Meet new people from around the world through anonymous video
          conversations. Start video calling instantly — no registration
          required.
        </p>
        <button onClick={handlestartvideo} className="flex items-center gap-3 px-6 py-3 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition-colors">
          <Video className="w-5 h-5" />
          <span className="font-medium">Start Video Call</span>
        </button>
      </section>

      {/* Features Section */}
      <section className="px-6 pb-20">
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {featurelist.map((feature, index) => (
            <div
              key={index}
              className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all duration-300"
            >
              <div className="flex items-center justify-center w-14 h-14 bg-gray-100 rounded-full mb-4">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-500">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
