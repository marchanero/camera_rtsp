// Controlador para gestionar cámaras
export const getAllCameras = async (req, res) => {
  try {
    const cameras = await req.prisma.camera.findMany({
      orderBy: { createdAt: 'desc' }
    })
    res.json(cameras)
  } catch (error) {
    console.error('Error al obtener cámaras:', error)
    res.status(500).json({ error: 'Error al obtener cámaras' })
  }
}

export const getCameraById = async (req, res) => {
  try {
    const { id } = req.params
    const camera = await req.prisma.camera.findUnique({
      where: { id: parseInt(id) }
    })
    
    if (!camera) {
      return res.status(404).json({ error: 'Cámara no encontrada' })
    }
    
    res.json(camera)
  } catch (error) {
    console.error('Error al obtener cámara:', error)
    res.status(500).json({ error: 'Error al obtener cámara' })
  }
}

export const createCamera = async (req, res) => {
  try {
    const { name, rtspUrl, description } = req.body
    
    if (!name || !rtspUrl) {
      return res.status(400).json({ error: 'El nombre y URL RTSP son obligatorios' })
    }
    
    const camera = await req.prisma.camera.create({
      data: {
        name,
        rtspUrl,
        description
      }
    })
    
    res.status(201).json(camera)
  } catch (error) {
    console.error('Error al crear cámara:', error)
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe una cámara con ese nombre o URL' })
    }
    res.status(500).json({ error: 'Error al crear cámara' })
  }
}

export const updateCamera = async (req, res) => {
  try {
    const { id } = req.params
    const { name, rtspUrl, description, isActive } = req.body
    
    const camera = await req.prisma.camera.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(rtspUrl && { rtspUrl }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive })
      }
    })
    
    res.json(camera)
  } catch (error) {
    console.error('Error al actualizar cámara:', error)
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Cámara no encontrada' })
    }
    res.status(500).json({ error: 'Error al actualizar cámara' })
  }
}

export const deleteCamera = async (req, res) => {
  try {
    const { id } = req.params
    
    await req.prisma.camera.delete({
      where: { id: parseInt(id) }
    })
    
    res.json({ message: 'Cámara eliminada correctamente' })
  } catch (error) {
    console.error('Error al eliminar cámara:', error)
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Cámara no encontrada' })
    }
    res.status(500).json({ error: 'Error al eliminar cámara' })
  }
}

export const testCamera = async (req, res) => {
  try {
    const { id } = req.params
    const camera = await req.prisma.camera.findUnique({
      where: { id: parseInt(id) }
    })
    
    if (!camera) {
      return res.status(404).json({ error: 'Cámara no encontrada' })
    }

    // Registrar intento de conexión
    await req.prisma.streamLog.create({
      data: {
        cameraId: camera.id,
        status: 'testing',
        message: 'Probando conexión RTSP'
      }
    })

    // Respuesta simulada (en producción, aquí iría la prueba real)
    res.json({
      success: true,
      camera: camera.name,
      rtspUrl: camera.rtspUrl,
      status: camera.isActive ? 'online' : 'offline',
      message: 'Conexión exitosa'
    })
  } catch (error) {
    console.error('Error al probar cámara:', error)
    res.status(500).json({ error: 'Error al probar cámara' })
  }
}
