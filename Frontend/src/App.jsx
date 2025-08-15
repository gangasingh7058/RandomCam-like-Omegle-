import { useState } from 'react'
import { BrowserRouter , Routes , Route } from 'react-router-dom'
import LandingPage from './Pages/Landing';
import VideoConferencePage from './Pages/VideoConferencePage';

  const App=()=>{  

  

  return <div>
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<LandingPage />} />
        <Route path='/video-conference' element={<VideoConferencePage />} />
      </Routes>
    </BrowserRouter>
  </div>
}

export default App
