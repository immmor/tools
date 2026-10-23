window.RobotModels = window.RobotModels || {};
(function () {
    // Small car: chassis + cabin + 4 steerable/rolling wheels, facing local +Z (forward)
    window.RobotModels.car = function (THREE) {
        const group = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.4, metalness: 0.3 });
        const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1d3557, roughness: 0.2, metalness: 0.1 });
        const glassMat = new THREE.MeshStandardMaterial({ color: 0xa8dadc, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.6 });
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6, metalness: 0.2 });
        const rimMat = new THREE.MeshStandardMaterial({ color: 0xced4da, roughness: 0.3, metalness: 0.8 });
        const headMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
        const tailMat = new THREE.MeshBasicMaterial({ color: 0xef233c });

        const bodyGroup = new THREE.Group();
        group.add(bodyGroup);

        const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.45, 2.6), bodyMat);
        chassis.position.y = 0.6;
        chassis.castShadow = true;
        bodyGroup.add(chassis);

        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 1.3), cabinMat);
        cabin.position.set(0, 1.0, -0.1);
        cabin.castShadow = true;
        bodyGroup.add(cabin);

        const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 0.1), glassMat);
        windshield.position.set(0, 1.0, 0.56);
        bodyGroup.add(windshield);

        [-0.4, 0.4].forEach(x => {
            const hl = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.08), headMat);
            hl.position.set(x, 0.6, 1.31);
            bodyGroup.add(hl);
            const tl = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.08), tailMat);
            tl.position.set(x, 0.6, -1.31);
            bodyGroup.add(tl);
        });

        const wheelRadius = 0.38;
        const wheels = [];
        const positions = [
            { x: -0.7, z: 0.9, front: true },
            { x: 0.7, z: 0.9, front: true },
            { x: -0.7, z: -0.9, front: false },
            { x: 0.7, z: -0.9, front: false }
        ];
        positions.forEach(p => {
            const steer = new THREE.Group();          // steering pivot (Y)
            steer.position.set(p.x, wheelRadius, p.z);
            bodyGroup.add(steer);
            const roll = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.3, 20), wheelMat);
            roll.rotation.z = Math.PI / 2;            // axle along X -> rolls about X
            roll.castShadow = true;
            steer.add(roll);
            const rim = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius * 0.5, wheelRadius * 0.5, 0.32, 12), rimMat);
            rim.rotation.z = Math.PI / 2;
            steer.add(rim);
            wheels.push({ steer, roll, front: p.front });
        });

        return {
            type: 'car',
            group: group,
            radius: 1.4,
            wheels: wheels,
            bodyGroup: bodyGroup,
            wheelRadius: wheelRadius
        };
    };
})();
