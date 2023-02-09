

export async function POST({request}){
    console.log(request);
    try{
        const data = await request.json();
        const regBalls = data.whiteBalls;
        const powerBalls = data.redBalls;
        let set = [];
        if(!regBalls || !powerBalls)return new Response(JSON.stringify({sucess:false,error: true,message:"Send all ball data from main app load",data:data}),{status:400})

        while (set.length < 5) {
            let randomIndex = Math.floor(Math.random() * regBalls.length);
            let randomObject = regBalls[randomIndex];
          
            if (!set.includes(randomObject.key)) {
                set.push(parseInt(randomObject.key));
            }
          }
          let randomIndex = Math.floor(Math.random() * powerBalls.length);
          let randomObject = powerBalls[randomIndex];
          set.push(parseInt(randomObject.key));
       
        return new Response(JSON.stringify({set:set,req:null}),{status:200})
    }
    catch{
        return new Response(JSON.stringify({sucess:false,error: true,message:"No body sent",data:data}),{status:400})
    }


    
}